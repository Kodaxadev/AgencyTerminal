// Agency Terminal Discord UI — Embed builders and button components.
// All embeds follow the SIG//AGENCY TERMINAL format.
// This package imports discord.js; @agency-terminal/core does NOT.

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import type {
  HealthCheckStatus,
  EvidenceRecord,
  ReviewRecord,
  ScoreEvent,
  EvidenceSourceType,
} from "@agency-terminal/core";

// --- Colors ---

export function statusColor(status: HealthCheckStatus): number {
  switch (status) {
    case "ok":
      return 0x34d399;
    case "warn":
      return 0xfbbf24;
    case "fail":
      return 0xf87171;
  }
}

// --- Generic status embeds ---

export function createStatusEmbed(
  title: string,
  code: number,
  label: string,
  body: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(`STATUS // CODE ${code} // ${label}\n\n${body}`)
    .setColor(statusColor(code < 300 ? "ok" : code < 500 ? "warn" : "fail"))
    .setFooter({ text: title });
}

export function createAcceptedEmbed(detail: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(`STATUS // CODE 200 // ACCEPTED\n\n${detail}`)
    .setColor(0x34d399);
}

export function createRejectedEmbed(detail: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(`STATUS // CODE 403 // REJECTED\n\n${detail}`)
    .setColor(0xf87171);
}

export function createArchivedEmbed(detail: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(
      `STATUS // CODE 204 // ARCHIVED\n\nNO FURTHER ACTION REQUIRED\n\n${detail}`,
    )
    .setColor(0x71717a);
}

export function createStaleEmbed(detail: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(
      `STATUS // CODE 408 // REVIEW TIMEOUT\n\n[ STALE — NEEDS RESOLUTION ]\n\n${detail}`,
    )
    .setColor(0xfbbf24);
}

// --- Evidence embeds ---

const SOURCE_TYPE_LABELS: Record<EvidenceSourceType, string> = {
  killboard: "Killboard",
  screenshot: "Screenshot",
  discord_message: "Discord Message",
  transaction_digest: "Transaction",
  world_api: "World API",
  manual: "Manual",
  signal_vault: "Signal Vault",
};

export function createEvidenceSubmissionEmbed(
  evidence: EvidenceRecord,
): EmbedBuilder {
  const fields = [
    { name: "SUBMITTED BY", value: `<@${evidence.submittedByDiscordId}>`, inline: true },
    { name: "CREDIT SUBJECT", value: `<@${evidence.subjectDiscordId}>`, inline: true },
    { name: "MODE", value: evidence.submittedMode, inline: true },
    { name: "METRIC", value: evidence.metricCategory, inline: true },
    { name: "SENSITIVITY", value: evidence.sensitivity, inline: true },
    { name: "REQUIRED APPROVALS", value: String(evidence.validationRequiredApprovals), inline: true },
  ];

  if (evidence.eventOccurredAt) {
    fields.push({
      name: "EVENT TIME",
      value: evidence.eventOccurredAt.toISOString(),
      inline: true,
    });
  }

  return new EmbedBuilder()
    .setTitle(`SIG// EVIDENCE: ${evidence.id}`)
    .setDescription(`**${evidence.title}**\n\n${evidence.description}`)
    .setColor(0x3b82f6)
    .addFields(fields)
    .setFooter({ text: `Status: ${evidence.status}` })
    .setTimestamp(evidence.createdAt);
}

export function createEvidenceStatusEmbed(
  evidence: EvidenceRecord,
  approvals: number,
  required: number,
): EmbedBuilder {
  const progress = "█".repeat(approvals) + "░".repeat(Math.max(0, required - approvals));
  return new EmbedBuilder()
    .setTitle(`SIG// EVIDENCE QUORUM: ${evidence.id}`)
    .setDescription(
      `Quorum: \`${progress}\` ${approvals}/${required}\nStatus: **${evidence.status}**`,
    )
    .setColor(approvals >= required ? 0x34d399 : 0xfbbf24)
    .setFooter({ text: evidence.metricCategory })
    .setTimestamp();
}

export function createEvidenceLinkEmbed(
  url: string,
  sourceType: EvidenceSourceType,
  parsed: boolean,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG// EVIDENCE LINK")
    .setDescription(`[${SOURCE_TYPE_LABELS[sourceType]}](${url})`)
    .setColor(parsed ? 0x34d399 : 0xfbbf24)
    .setFooter({ text: parsed ? "Parsed successfully" : "Pending parse / manual review" });
}

// --- Review embeds ---

export function createReviewRequestEmbed(
  evidence: EvidenceRecord,
  reviewerDiscordId: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG// REVIEW REQUEST")
    .setDescription(
      `Evidence **${evidence.id}** requires review.\n` +
      `Metric: ${evidence.metricCategory}\n` +
      `Submitted by: <@${evidence.submittedByDiscordId}>\n` +
      `Credit subject: <@${evidence.subjectDiscordId}>`,
    )
    .setColor(0xf59e0b)
    .addFields({
      name: "REVIEWER",
      value: `<@${reviewerDiscordId}>`,
      inline: true,
    })
    .setTimestamp();
}

export function createReviewResultEmbed(
  review: ReviewRecord,
  evidenceId: string,
): EmbedBuilder {
  const decisionEmoji =
    review.decision === "approve"
      ? "✅ APPROVED"
      : review.decision === "object"
        ? "❌ OBJECTED"
        : "⚠️ NEEDS MORE EVIDENCE";

  const fields = [
    { name: "REVIEWER", value: `<@${review.reviewerDiscordId}>`, inline: true },
    { name: "DECISION", value: decisionEmoji, inline: true },
  ];

  if (review.qualityTier) {
    fields.push({ name: "QUALITY TIER", value: review.qualityTier, inline: true });
  }
  if (review.conflictDisclosed) {
    fields.push({
      name: "CONFLICT",
      value: review.conflictReason ?? "Disclosed",
      inline: true,
    });
  }

  return new EmbedBuilder()
    .setTitle(`SIG// REVIEW RESULT: ${evidenceId}`)
    .setDescription(review.rationale)
    .setColor(
      review.decision === "approve"
        ? 0x34d399
        : review.decision === "object"
          ? 0xf87171
          : 0xfbbf24,
    )
    .addFields(fields)
    .setTimestamp(review.createdAt);
}

// --- Score embeds ---

export function createScoreCreditEmbed(
  event: ScoreEvent,
  subjectDiscordId?: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG// SCORE CREDITED")
    .setDescription(
      `+**${event.pointsApproved}** points → ${event.metricCategory}\n` +
      `Agent: <@${event.agentDiscordId}>` +
      (subjectDiscordId ? ` (submitted by <@${subjectDiscordId}>)` : ""),
    )
    .setColor(0x34d399)
    .addFields(
      { name: "SOURCE", value: event.pointSource, inline: true },
      { name: "TABLE VERSION", value: String(event.pointsTableVersion), inline: true },
      { name: "CREDITED BY", value: `<@${event.creditedBy}>`, inline: true },
    )
    .setTimestamp(event.creditedAt);
}

export function createScoreReversalEmbed(
  eventId: string,
  requestedBy: string,
  reason: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("SIG// SCORE REVERSED")
    .setDescription(
      `Score event **${eventId}** has been reversed.\n\n**Reason:** ${reason}`,
    )
    .setColor(0xf87171)
    .addFields(
      { name: "REQUESTED BY", value: `<@${requestedBy}>`, inline: true },
    )
    .setTimestamp();
}

// --- Audit log embed ---

export function createAuditLogEmbed(
  action: string,
  subjectType: string,
  subjectId: string,
  actorDiscordId?: string,
  details?: string,
): EmbedBuilder {
  const fields = [
    { name: "ACTION", value: action, inline: true },
    { name: "SUBJECT", value: `${subjectType}:${subjectId}`, inline: true },
  ];
  if (actorDiscordId) {
    fields.push({ name: "ACTOR", value: `<@${actorDiscordId}>`, inline: true });
  }

  return new EmbedBuilder()
    .setTitle("SIG// AUDIT LOG")
    .setColor(0x6366f1)
    .addFields(fields)
    .setDescription(details ?? null)
    .setTimestamp();
}

// --- Button components ---

export function createReviewButtons(evidenceId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`review:approve:${evidenceId}`)
        .setLabel("Approve")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`review:object:${evidenceId}`)
        .setLabel("Object")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`review:needs_more:${evidenceId}`)
        .setLabel("Needs More Evidence")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export function createEvidenceActionButtons(evidenceId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`evidence:edit:${evidenceId}`)
        .setLabel("Edit")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`evidence:appeal:${evidenceId}`)
        .setLabel("Appeal")
        .setStyle(ButtonStyle.Primary),
    ),
  ];
}

export function createStaleAlertButtons(evidenceId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`stale:escalate:${evidenceId}`)
        .setLabel("Escalate to Director")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`stale:dismiss:${evidenceId}`)
        .setLabel("Dismiss")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];
}
