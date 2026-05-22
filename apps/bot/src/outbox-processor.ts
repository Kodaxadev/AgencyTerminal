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
} from "@agency-terminal/db";
import { buildDenyEveryoneOverwrite } from "./safety";

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
      await markEvidenceStale(ev.id);
      await postStaleAlert(client, guildId, ev);
      staleAlerts++;
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

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: [buildDenyEveryoneOverwrite(guild.roles.everyone.id), allowCreator(creatorId)],
    topic: `${title} | ${ticketShortId}`,
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
): Promise<void> {
  const guild = await client.guilds.fetch(guildId);
  const opsChannel = guild.channels.cache.find(
    (ch) => ch.name === "ops-queue" && ch.type === ChannelType.GuildText,
  ) as TextChannel | undefined;

  if (!opsChannel) return;

  const staleId = ev.shortId ?? ev.id;
  const embed = new EmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(
      `STATUS // CODE 408 // REVIEW TIMEOUT\n\n[ STALE - NEEDS RESOLUTION ]\n\nEvidence **${staleId}** has exceeded the 48h review window.\nMetric: \`${ev.metricCategory}\`\nUse \`/director override\` to force-validate or review immediately.`,
    )
    .setColor(0xfbbf24)
    .setTimestamp();

  await opsChannel.send({
    content: "Stale evidence alert: @everyone",
    embeds: [embed],
  });
}
