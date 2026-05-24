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
import { resolveOpsQueueChannel } from "./ops-queue";

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

function logStaleFailure(
  event: "stale_alert_routing_failed" | "stale_alert_send_failed",
  guildId: string,
  evidenceId: string,
  reason: string,
  error?: unknown,
) {
  const payload: Record<string, unknown> = { level: "error", event, guildId, evidenceId, reason };
  if (error instanceof Error) {
    payload.error = { name: error.name, message: error.message };
  }
  console.error(JSON.stringify(payload));
}

async function postStaleAlert(
  client: Client,
  guildId: string,
  ev: { id: string; shortId: string | null; title: string; metricCategory: string },
): Promise<"sent" | "missing_ops_channel" | "send_failed"> {
  let opsChannel: TextChannel;
  try {
    opsChannel = await resolveOpsQueueChannel(client, guildId);
  } catch (err) {
    logStaleFailure("stale_alert_routing_failed", guildId, ev.id, "ops_queue_setup_failed", err);
    return "missing_ops_channel";
  }

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
  } catch (err) {
    logStaleFailure("stale_alert_send_failed", guildId, ev.id, "discord_send_failed", err);
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
  if (!metricCategory) throw new Error(`evidence_review_projection payload invalid metricCategory: ${String(p.metricCategory)}`);

  const sensitivity = VALID_SENSITIVITIES.includes(p.sensitivity as EvidenceRecord["sensitivity"]) ? p.sensitivity as EvidenceRecord["sensitivity"] : null;
  if (!sensitivity) throw new Error(`evidence_review_projection payload invalid sensitivity: ${String(p.sensitivity)}`);

  const title = typeof p.title === "string" ? p.title : null;
  if (title === null) throw new Error("evidence_review_projection payload missing or invalid title");

  const description = typeof p.description === "string" ? p.description : null;
  if (description === null) throw new Error("evidence_review_projection payload missing or invalid description");

  const vra = p.validationRequiredApprovals;
  if (typeof vra !== "number" || !Number.isInteger(vra) || vra < 1) {
    throw new Error(`evidence_review_projection payload invalid validationRequiredApprovals: ${String(vra)}`);
  }

  const submittedMode = VALID_MODES.includes(p.submittedMode as EvidenceRecord["submittedMode"]) ? p.submittedMode as EvidenceRecord["submittedMode"] : null;
  if (!submittedMode) throw new Error(`evidence_review_projection payload invalid submittedMode: ${String(p.submittedMode)}`);

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
  const evidenceRecord = validateReviewProjectionPayload(msg.payload);
  // Safe: validate already confirmed msg.payload.evidenceId is a non-empty string
  const canonicalEvidenceId = msg.payload.evidenceId as string;
  const displayId = evidenceRecord.id;
  const channel = await resolveOpsQueueChannel(client, msg.guildId);

  if (await hasExistingReviewMarker(channel, canonicalEvidenceId)) {
    return;
  }

  const marker = getEvidenceReviewMarker(canonicalEvidenceId);

  await channel.send({
    content: `Evidence review ${marker}`,
    embeds: [createEvidenceSubmissionEmbed({ ...evidenceRecord, id: displayId })],
    components: createReviewButtons(canonicalEvidenceId),
  });
}
