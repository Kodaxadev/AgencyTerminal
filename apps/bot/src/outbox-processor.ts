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
import {
  createEvidenceSubmissionEmbed,
  createReviewButtons,
} from "@agency-terminal/discord-ui";
import type { EvidenceRecord, MetricCategory, Sensitivity } from "@agency-terminal/core";

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
      } else if (msg.eventType === "evidence_review_projection") {
        await handleEvidenceReviewProjectionOutbox(client, msg);
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
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(
      JSON.stringify({
        level: "error",
        event: "stale_evidence_scan_failed",
        guildId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    );
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
  const fetchedChannels = await guild.channels.fetch();
  const existingChannel = ticketId
    ? findExistingTicketChannel(Array.from(fetchedChannels.values()).filter((channel) => channel !== null), ticketId)
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
  const fetchedChannels = await guild.channels.fetch();
  const opsChannel = Array.from(fetchedChannels.values()).filter((channel) => channel !== null).find(
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

function getEvidenceReviewMarker(evidenceId: string): string {
  return `[evidence-review:${evidenceId}]`;
}

async function hasExistingReviewMarker(channel: TextChannel, evidenceId: string): Promise<boolean> {
  const marker = getEvidenceReviewMarker(evidenceId);
  const messages = await channel.messages.fetch({ limit: 50 });
  return Array.from(messages.values()).some((m) => m.content?.includes(marker));
}

const VALID_METRICS: MetricCategory[] = [
  "pvp_kill_value", "fleet_participation", "contracts_completed",
  "intelligence_acquisitions", "technical_development_output",
  "asset_contributions", "exploration", "lore_discovery",
];
const VALID_SENSITIVITIES: Sensitivity[] = ["public", "member", "officer_only", "director_only"];
const VALID_MODES: EvidenceRecord["submittedMode"][] = ["live_bot", "manual_backfill", "imported"];

function validateReviewProjectionPayload(p: Record<string, unknown>): EvidenceRecord {
  const evidenceId = typeof p.evidenceId === "string" && p.evidenceId.length > 0 ? p.evidenceId : null;
  if (!evidenceId) throw new Error("evidence_review_projection payload missing or empty evidenceId");

  const submittedByDiscordId = typeof p.submittedByDiscordId === "string" && p.submittedByDiscordId.length > 0 ? p.submittedByDiscordId : null;
  if (!submittedByDiscordId) throw new Error("evidence_review_projection payload missing or empty submittedByDiscordId");

  const subjectDiscordId = typeof p.subjectDiscordId === "string" && p.subjectDiscordId.length > 0 ? p.subjectDiscordId : null;
  if (!subjectDiscordId) throw new Error("evidence_review_projection payload missing or empty subjectDiscordId");

  const metricCategory = VALID_METRICS.includes(p.metricCategory as MetricCategory) ? p.metricCategory as MetricCategory : null;
  if (!metricCategory) throw new Error(`evidence_review_projection payload invalid metricCategory: ${p.metricCategory}`);

  const sensitivity = VALID_SENSITIVITIES.includes(p.sensitivity as EvidenceRecord["sensitivity"]) ? p.sensitivity as EvidenceRecord["sensitivity"] : null;
  if (!sensitivity) throw new Error(`evidence_review_projection payload invalid sensitivity: ${p.sensitivity}`);

  const title = typeof p.title === "string" ? p.title : null;
  if (title === null) throw new Error("evidence_review_projection payload missing or invalid title");

  const description = typeof p.description === "string" ? p.description : null;
  if (description === null) throw new Error("evidence_review_projection payload missing or invalid description");

  const vra = p.validationRequiredApprovals;
  if (typeof vra !== "number" || !Number.isInteger(vra) || vra < 1) {
    throw new Error(`evidence_review_projection payload invalid validationRequiredApprovals: ${vra}`);
  }

  const submittedMode = VALID_MODES.includes(p.submittedMode as EvidenceRecord["submittedMode"]) ? p.submittedMode as EvidenceRecord["submittedMode"] : null;
  if (!submittedMode) throw new Error(`evidence_review_projection payload invalid submittedMode: ${p.submittedMode}`);

  if (p.evidenceShortId !== undefined && p.evidenceShortId !== null && typeof p.evidenceShortId !== "string") {
    throw new Error(`evidence_review_projection payload invalid evidenceShortId type: ${typeof p.evidenceShortId}`);
  }
  const evidenceShortId = typeof p.evidenceShortId === "string" ? p.evidenceShortId : null;

  return {
    id: evidenceShortId ?? evidenceId,
    guildId: "",
    submittedByDiscordId,
    subjectDiscordId,
    metricCategory,
    status: "under_review",
    sensitivity,
    title,
    description,
    validationRequiredApprovals: vra,
    submittedMode,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function handleEvidenceReviewProjectionOutbox(
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
  const opsQueueChannelId = process.env.AGENCY_OPS_QUEUE_CHANNEL_ID;
  if (!opsQueueChannelId) {
    throw new Error("AGENCY_OPS_QUEUE_CHANNEL_ID not configured");
  }

  const canonicalEvidenceId = msg.payload.evidenceId as string;
  const evidenceRecord = validateReviewProjectionPayload(msg.payload);
  const displayId = evidenceRecord.id;
  const evidenceId = canonicalEvidenceId;

  const guild = await client.guilds.fetch(msg.guildId);
  const channel = await guild.channels.fetch(opsQueueChannelId);

  if (!channel) {
    throw new Error(`Configured ops-queue channel ${opsQueueChannelId} not found`);
  }
  if (channel.type !== ChannelType.GuildText) {
    throw new Error(`Configured ops-queue channel ${opsQueueChannelId} is not a guild text channel`);
  }

  const everyoneOverwrite = channel.permissionOverwrites.resolve(guild.roles.everyone.id);
  if (!everyoneOverwrite || !everyoneOverwrite.deny?.has(PermissionsBitField.Flags.ViewChannel)) {
    throw new Error(`Configured ops-queue channel ${opsQueueChannelId} is viewable by @everyone`);
  }

  if (await hasExistingReviewMarker(channel, evidenceId)) {
    return;
  }

  const marker = getEvidenceReviewMarker(evidenceId);

  await channel.send({
    content: `Evidence review ${marker}`,
    embeds: [createEvidenceSubmissionEmbed({ ...evidenceRecord, id: displayId })],
    components: createReviewButtons(evidenceId),
  });
}
