import type { MetricConfig, EvidenceSubject } from "../evidence/types";
import type { ScoreEvent } from "./types";

export interface ScoreCreditResult {
  events: ScoreEvent[];
  totalPoints: number;
}

/**
 * Calculate score events for all creditable subjects of an evidence record.
 * Pure function — no side effects, no DB access.
 */
export function calculateScoreCredits(
  subjects: EvidenceSubject[],
  metricConfig: MetricConfig,
  evidenceId: string,
  guildId: string,
  creditedBy: string,
  creditedAt: Date
): ScoreCreditResult {
  if (!metricConfig.enabled) {
    return { events: [], totalPoints: 0 };
  }

  const events: ScoreEvent[] = [];
  let totalPoints = 0;

  for (const subject of subjects) {
    // Only primary and supporting roles receive score
    if (subject.role === "witness_only") continue;

    const points = Math.round(metricConfig.basePoints * subject.pointMultiplier);
    if (points < 0) continue;

    const event: ScoreEvent = {
      id: crypto.randomUUID(),
      guildId,
      evidenceId,
      agentDiscordId: subject.subjectDiscordId,
      metricCategory: metricConfig.category,
      pointSource: "configured_table",
      pointsApproved: points,
      pointsTableVersion: metricConfig.version,
      creditedBy,
      creditedAt,
      status: "credited",
    };

    events.push(event);
    totalPoints += points;
  }

  return { events, totalPoints };
}

/**
 * Validate a score reversal meets the required conditions.
 * Pure function — returns validation result with reasons.
 */
export function validateScoreReversal(input: {
  requestedBy: string;
  corroboratedBy: string;
  reason: string;
}): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!input.requestedBy) {
    reasons.push("requestedBy is required");
  }
  if (!input.corroboratedBy) {
    reasons.push("corroboratedBy is required (one corroborating officer)");
  }
  if (input.requestedBy === input.corroboratedBy) {
    reasons.push("requestedBy and corroboratedBy must be different actors");
  }
  if (!input.reason || input.reason.length < 12) {
    reasons.push("reason is required and must be at least 12 characters");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * Validate a score correction request.
 */
export function validateScoreCorrection(input: {
  correctionType: string;
  requestedBy: string;
  reason: string;
}): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!input.requestedBy) {
    reasons.push("requestedBy is required");
  }
  if (!input.reason || input.reason.length < 12) {
    reasons.push("reason is required and must be at least 12 characters");
  }
  if (
    input.correctionType !== "restore_reversed_score" &&
    input.correctionType !== "adjust_score_after_review"
  ) {
    reasons.push("correctionType must be 'restore_reversed_score' or 'adjust_score_after_review'");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * Compute the net score for an agent in a given metric category
 * from a list of score events.
 */
export function computeNetScore(
  events: Pick<ScoreEvent, "metricCategory" | "pointsApproved" | "status">[],
  agentDiscordId: string,
  category?: string
): number {
  let total = 0;
  for (const event of events) {
    if (event.status === "reversed") continue;
    if (category && event.metricCategory !== category) continue;
    total += event.pointsApproved;
  }
  return total;
}
