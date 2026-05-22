import { ButtonInteraction } from "discord.js";
import { calculateScoreCredits } from "@agency-terminal/core";
import type { MetricCategory } from "@agency-terminal/core";
import { creditScore, writeAuditLog } from "@agency-terminal/db";
import { createScoreCreditEmbed } from "@agency-terminal/discord-ui";

/**
 * Process score credits after quorum is reached.
 * Writes to DB with idempotency and audit log.
 */
export async function processScoreCredits(
  interaction: ButtonInteraction,
  evidenceId: string,
  guildId: string,
  agentDiscordId: string,
  metricCategory: string,
): Promise<void> {
  const metricConfig = {
    category: metricCategory as MetricCategory,
    basePoints: 10,
    visibility: "public" as const,
    enabled: true,
    version: 1,
  };

  const subjects = [
    {
      evidenceId,
      subjectDiscordId: agentDiscordId,
      role: "primary" as const,
      pointMultiplier: 1.0,
    },
  ];

  const creditResult = calculateScoreCredits(
    subjects,
    metricConfig,
    evidenceId,
    guildId,
    "system",
    new Date(),
  );

  for (const event of creditResult.events) {
    const idempotencyKey = `score:credit:${evidenceId}:${event.agentDiscordId}`;
    await creditScore({
      evidenceId,
      guildId,
      agentDiscordId: event.agentDiscordId,
      metricCategory: event.metricCategory,
      pointsApproved: event.pointsApproved,
      creditedBy: event.creditedBy,
    }, idempotencyKey);

    await writeAuditLog({
      guildId,
      action: "score_credited",
      subjectType: "score_event",
      subjectId: evidenceId,
      payload: { agent: event.agentDiscordId, points: event.pointsApproved },
    });

    const scoreEmbed = createScoreCreditEmbed(event);
    await interaction.followUp({
      content: `**Quorum reached for ${evidenceId}!** Score credited.`,
      embeds: [scoreEmbed],
      ephemeral: false,
    });
  }
}
