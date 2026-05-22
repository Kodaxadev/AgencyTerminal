import {
  ChannelType,
  Client,
  Guild,
  PermissionOverwrites,
  PermissionsBitField,
  TextChannel,
  EmbedBuilder,
} from "discord.js";
import { fetchDueOutbox, markOutboxSent, markOutboxFailed, findStaleEvidence, markEvidenceStale } from "@agency-terminal/db";

function denyEveryone() {
  return { deny: new PermissionsBitField([PermissionsBitField.Flags.ViewChannel]), id: "everyone" as any };
}

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

/**
 * Process due outbox messages by creating Discord channels for tickets.
 * Called on a timer (e.g. every 10 seconds).
 */
export async function processOutbox(
  client: Client,
  guildId: string,
  maxBatch = 20
): Promise<{ processed: number; errors: number; staleAlerts: number }> {
  const messages = await fetchDueOutbox(maxBatch);
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

  // Check for stale evidence and post to ops queue
  try {
    const stale = await findStaleEvidence(guildId);
    for (const ev of stale) {
      await markEvidenceStale(ev.id);
      await postStaleAlert(client, guildId, ev);
      staleAlerts++;
    }
  } catch {
    // Stale check failure is non-fatal
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

  const channelName = `${ticketType}-${ticketShortId}`.toLowerCase().replace(/_/g, "-");

  const overwrites = [denyEveryone(), allowCreator(creatorId)];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
    topic: `${title} | ${ticketShortId}`,
    reason: `Ticket ${ticketShortId} created`,
  });

  // Send welcome message
  await (channel as TextChannel).send({
    content: `<@${creatorId}> — Your ticket **${ticketShortId}** has been created.`,
  });
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
      `STATUS // CODE 408 // REVIEW TIMEOUT\n\n[ STALE — NEEDS RESOLUTION ]\n\nEvidence **${staleId}** has exceeded the 48h review window.\nMetric: \`${ev.metricCategory}\`\nUse \`/director override\` to force-validate or review immediately.`,
    )
    .setColor(0xfbbf24)
    .setTimestamp();

  await opsChannel.send({
    content: `⚠️ Stale evidence alert: <@&everyone>`,
    embeds: [embed],
  });
}
