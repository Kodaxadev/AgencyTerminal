import type { ReviewRecord, EvidenceRecord, MetricCategory } from "./types";

// Quorum requirements by metric category
const QUORUM_REQUIREMENTS: Record<MetricCategory, number> = {
  pvp_kill_value: 2,
  fleet_participation: 1,
  contracts_completed: 2,
  intelligence_acquisitions: 2,
  technical_development_output: 1,
  asset_contributions: 1,
  exploration: 1,
  lore_discovery: 1,
};

export function getQuorumRequirement(category: MetricCategory): number {
  return QUORUM_REQUIREMENTS[category];
}

export interface QuorumResult {
  reached: boolean;
  approvals: number;
  objections: number;
  needsMoreEvidence: number;
  required: number;
}

export function evaluateQuorum(
  reviews: ReviewRecord[],
  category: MetricCategory
): QuorumResult {
  const required = getQuorumRequirement(category);
  const approvals = reviews.filter((r) => r.decision === "approve").length;
  const objections = reviews.filter((r) => r.decision === "object").length;
  const needsMoreEvidence = reviews.filter(
    (r) => r.decision === "needs_more_evidence"
  ).length;

  return {
    reached: approvals >= required,
    approvals,
    objections,
    needsMoreEvidence,
    required,
  };
}

export function canValidateEvidence(
  evidence: EvidenceRecord,
  reviews: ReviewRecord[],
  now?: Date
): { canValidate: boolean; reason: string } {
  if (evidence.status !== "under_review") {
    return { canValidate: false, reason: `Evidence status is '${evidence.status}', not 'under_review'` };
  }

  const quorum = evaluateQuorum(reviews, evidence.metricCategory);
  if (quorum.reached) {
    return { canValidate: true, reason: `Quorum reached: ${quorum.approvals}/${quorum.required} approvals` };
  }

  // Check for stale review timeout
  const currentTime = now ?? new Date();
  if (evidence.staleAfter && currentTime >= evidence.staleAfter) {
    return { canValidate: false, reason: `Evidence stale since ${evidence.staleAfter.toISOString()}, requires director_override` };
  }

  return {
    canValidate: false,
    reason: `Quorum not reached: ${quorum.approvals}/${quorum.required} approvals`,
  };
}

export function shouldMarkStale(
  evidence: EvidenceRecord,
  staleReviewHours: number,
  now?: Date
): boolean {
  if (evidence.status !== "under_review") return false;
  if (evidence.staleNotifiedAt) return false;

  const currentTime = now ?? new Date();
  const staleThreshold = new Date(
    evidence.createdAt.getTime() + staleReviewHours * 60 * 60 * 1000
  );

  return currentTime >= staleThreshold;
}
