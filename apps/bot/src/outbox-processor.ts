import {
  ChannelType,
  Client,
  EmbedBuilder,
  PermissionsBitField,
  TextChannel,
} from "discord.js";
import {
  claimDueOutbox,
  findStaleEvidence,
  markEvidenceStale,
  markOutboxFailed,
  markOutboxSent,
  persistTicketChannelId,
  writeAuditLog,
} from "@agency-terminal/db";
import {
  buildDenyEveryoneOverwrite,
  findExistingTicketChannel,
  getStaleAlertContent,
  getTicketChannelTopic,
  hasExistingStaleAlert,
  shouldMarkStaleAlertNotified,
} from "./safety";

function allowCreator(discordId: string) {
  return {
    allow: new PermissionsBitField([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
    ]),
    id: discordId,
  };
}

export async function processOutbox(
  client: Client,
  guildId: string,
  maxBatch = 20,
): Promise<{ processed: number; errors: number; staleAlerts: number }> {
  const messages = await claimDueOutbox(maxBatch);
  let processed = 0;
  let errors = 0;
  let staleAlerts = 0;

  for (const msg of messages) {
    try {
      if (msg.eventType === "ticket_created") {
        await handleTicketCreatedOutbox(client, msg);
      }
      await markOutboxSent(msg.id);
      processed++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await markOutboxFailed(msg.id, message);
      errors++;
    }
  }

  try {
    const stale = await findStaleEvidence(guildId);
    for (const ev of stale) {
      const status = await postStaleAlert(client, guildId, ev);
      if (shouldMarkStaleAlertNotified(status)) {
        await markEvidenceStale(ev.id);
        staleAlerts++;
      }
    }
  } catch {
    // Stale check failure is non-fatal to outbox projection processing.
  }

  return { processed, errors, staleAlerts };
}

async function handleTicketCreatedOutbox(
  client: Client,
  msg: {
    id: string;
    guildId: string;
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  },
): Promise<void> {
  const guild = await client.guilds.fetch(msg.guildId);
  const p = msg.payload;
  const ticketShortId = (p.ticketShortId as string) ?? "unknown";
  const ticketType = (p.ticketType as string) ?? "general";
  const creatorId = p.creatorDiscordId as string;
  const title = (p.title as string) ?? "Ticket";
  const ticketId = p.ticketId as string | undefined;
  const channelName = `${ticketType}-${ticketShortId}`.toLowerCase().replace(/_/g, "-");
  const existingChannel = ticketId
    ? findExistingTicketChannel(Array.from(guild.channels.cache.values()), ticketId)
    : undefined;

  if (ticketId && existingChannel) {
    await persistTicketChannelId(ticketId, existingChannel.id);
    await writeAuditLog({
      guildId: msg.guildId,
      actorDiscordId: "system",
      action: "discord_channel_reconciled",
      subjectType: "ticket",
      subjectId: ticketId,
      sensitivity: "officer_only",
      payload: { channelId: existingChannel.id, outboxId: msg.id },
    });
    return;
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: [buildDenyEveryoneOverwrite(guild.roles.everyone.id), allowCreator(creatorId)],
    topic: getTicketChannelTopic(title, ticketShortId, ticketId),
    reason: `Ticket ${ticketShortId} created`,
  });

  await channel.send({
    content: `<@${creatorId}> - Your ticket **${ticketShortId}** has been created.`,
  });

  if (ticketId) {
    await persistTicketChannelId(ticketId, channel.id);
  }
}

async function postStaleAlert(
  client: Client,
  guildId: string,
  ev: { id: string; shortId: string | null; title: string; metricCategory: string },
): Promise<"sent" | "missing_ops_channel" | "send_failed"> {
  const guild = await client.guilds.fetch(guildId);
  const opsChannel = guild.channels.cache.find(
    (ch) => ch.name === "ops-queue" && ch.type === ChannelType.GuildText,
  ) as TextChannel | undefined;

  if (!opsChannel) return "missing_ops_channel";
  if (await staleAlertAlreadyPosted(opsChannel, ev.id)) return "sent";

  const staleId = ev.shortId ?? ev.id;
  const embed = new EmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(
      `STATUS // CODE 408 // REVIEW TIMEOUT\n\n[ STALE - NEEDS RESOLUTION ]\n\nEvidence **${staleId}** has exceeded the 48h review window.\nMetric: \`${ev.metricCategory}\`\nUse \`/director override\` to force-validate or review immediately.`,
    )
    .setColor(0xfbbf24)
    .setTimestamp();

  try {
    await opsChannel.send({
      content: getStaleAlertContent(ev.id),
      embeds: [embed],
    });
    return "sent";
  } catch {
    return "send_failed";
  }
}

async function staleAlertAlreadyPosted(channel: TextChannel, evidenceId: string): Promise<boolean> {
  const messages = await channel.messages.fetch({ limit: 50 });
  return hasExistingStaleAlert(Array.from(messages.values()), evidenceId);
}
