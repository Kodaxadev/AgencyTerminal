import { describe, it, expect } from "vitest";
import {
  evaluateQuorum,
  getQuorumRequirement,
  canValidateEvidence,
  shouldMarkStale,
  calculateScoreCredits,
  validateScoreReversal,
  validateScoreCorrection,
  computeNetScore,
} from "../index";
import type { ReviewRecord, EvidenceRecord, EvidenceSubject, MetricConfig, EvidenceStatus } from "../index";

function makeReview(
  reviewerDiscordId: string,
  decision: "approve" | "object" | "needs_more_evidence"
): ReviewRecord {
  return {
    evidenceId: "evd-001",
    reviewerDiscordId,
    decision,
    rationale: "Test review",
    conflictDisclosed: false,
    createdAt: new Date(),
  };
}

function makeEvidence(
  category: "pvp_kill_value" | "fleet_participation" = "pvp_kill_value",
  status: EvidenceStatus = "under_review",
  staleAfter?: Date
): EvidenceRecord {
  const now = new Date();
  return {
    id: "evd-001",
    guildId: "guild-1",
    submittedByDiscordId: "user-1",
    subjectDiscordId: "user-2",
    metricCategory: category,
    status,
    sensitivity: "member",
    title: "Test evidence",
    description: "",
    validationRequiredApprovals: 2,
    staleAfter,
    submittedMode: "live_bot",
    createdAt: now,
    updatedAt: now,
  };
}

// --- Quorum idempotency tests ---

describe("evaluateQuorum idempotency", () => {
  it("returns same result for same input regardless of call order", () => {
    const reviews: ReviewRecord[] = [
      makeReview("r1", "approve"),
      makeReview("r2", "approve"),
    ];

    const r1 = evaluateQuorum(reviews, "pvp_kill_value");
    const r2 = evaluateQuorum(reviews, "pvp_kill_value");
    const r3 = evaluateQuorum(reviews, "pvp_kill_value");

    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
    expect(r1.reached).toBe(true);
    expect(r1.approvals).toBe(2);
    expect(r1.required).toBe(2);
  });

  it("does not reach quorum with single approval for pvp", () => {
    const reviews = [makeReview("r1", "approve")];
    const result = evaluateQuorum(reviews, "pvp_kill_value");
    expect(result.reached).toBe(false);
    expect(result.approvals).toBe(1);
    expect(result.required).toBe(2);
  });

  it("fleet participation requires only 1 approval", () => {
    const reviews = [makeReview("r1", "approve")];
    const result = evaluateQuorum(reviews, "fleet_participation");
    expect(result.reached).toBe(true);
    expect(result.required).toBe(1);
  });

  it("objections do not block quorum but are counted", () => {
    const reviews = [
      makeReview("r1", "approve"),
      makeReview("r2", "approve"),
      makeReview("r3", "object"),
    ];
    const result = evaluateQuorum(reviews, "pvp_kill_value");
    expect(result.reached).toBe(true);
    expect(result.objections).toBe(1);
  });
});

describe("getQuorumRequirement", () => {
  it.each([
    ["pvp_kill_value", 2],
    ["fleet_participation", 1],
    ["contracts_completed", 2],
    ["intelligence_acquisitions", 2],
    ["technical_development_output", 1],
    ["asset_contributions", 1],
    ["exploration", 1],
    ["lore_discovery", 1],
  ])("%s requires %d approvals", (category, required) => {
    expect(getQuorumRequirement(category as any)).toBe(required);
  });
});

describe("canValidateEvidence", () => {
  it("allows validation when quorum is reached", () => {
    const evidence = makeEvidence("pvp_kill_value", "under_review");
    const reviews = [makeReview("r1", "approve"), makeReview("r2", "approve")];
    const result = canValidateEvidence(evidence, reviews);
    expect(result.canValidate).toBe(true);
  });

  it("blocks validation when status is not under_review", () => {
    const evidence = makeEvidence("pvp_kill_value", "submitted");
    const reviews = [makeReview("r1", "approve"), makeReview("r2", "approve")];
    const result = canValidateEvidence(evidence, reviews);
    expect(result.canValidate).toBe(false);
    expect(result.reason).toContain("submitted");
  });

  it("blocks validation when stale and timeout passed", () => {
    const staleDate = new Date(Date.now() - 1000); // already past
    const evidence = makeEvidence("pvp_kill_value", "under_review", staleDate);
    const reviews = [makeReview("r1", "approve")]; // only 1 of 2
    const result = canValidateEvidence(evidence, reviews);
    expect(result.canValidate).toBe(false);
    expect(result.reason).toContain("stale");
  });
});

describe("shouldMarkStale", () => {
  it("marks stale after threshold hours", () => {
    const createdAt = new Date(Date.now() - 50 * 60 * 60 * 1000); // 50 hours ago
    const evidence = makeEvidence("pvp_kill_value", "under_review");
    evidence.createdAt = createdAt;
    expect(shouldMarkStale(evidence, 48)).toBe(true);
  });

  it("does not mark stale before threshold", () => {
    const evidence = makeEvidence("pvp_kill_value", "under_review");
    expect(shouldMarkStale(evidence, 48)).toBe(false);
  });

  it("does not mark stale if already notified", () => {
    const evidence = makeEvidence("pvp_kill_value", "under_review");
    evidence.staleNotifiedAt = new Date();
    expect(shouldMarkStale(evidence, 48)).toBe(false);
  });
});

// --- Scoring tests ---

describe("calculateScoreCredits", () => {
  const metricConfig: MetricConfig = {
    category: "pvp_kill_value",
    basePoints: 10,
    visibility: "public",
    enabled: true,
    version: 1,
  };

  it("creates one score event per creditable subject", () => {
    const subjects: EvidenceSubject[] = [
      { evidenceId: "evd-001", subjectDiscordId: "user-1", role: "primary", pointMultiplier: 1.0 },
      { evidenceId: "evd-001", subjectDiscordId: "user-2", role: "supporting", pointMultiplier: 1.0 },
      { evidenceId: "evd-001", subjectDiscordId: "user-3", role: "witness_only", pointMultiplier: 1.0 },
    ];

    const result = calculateScoreCredits(subjects, metricConfig, "evd-001", "guild-1", "director-1", new Date());
    expect(result.events).toHaveLength(2);
    expect(result.totalPoints).toBe(20);
    expect(result.events.every((e) => e.status === "credited")).toBe(true);
  });

  it("returns empty when metric is disabled", () => {
    const disabledConfig = { ...metricConfig, enabled: false };
    const subjects: EvidenceSubject[] = [
      { evidenceId: "evd-001", subjectDiscordId: "user-1", role: "primary", pointMultiplier: 1.0 },
    ];
    const result = calculateScoreCredits(subjects, disabledConfig, "evd-001", "guild-1", "director-1", new Date());
    expect(result.events).toHaveLength(0);
    expect(result.totalPoints).toBe(0);
  });
});

describe("validateScoreReversal", () => {
  it("accepts valid reversal", () => {
    const result = validateScoreReversal({
      requestedBy: "director-1",
      corroboratedBy: "officer-1",
      reason: "Evidence was fabricated, screenshot was doctored",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects when same actor requests and corroborates", () => {
    const result = validateScoreReversal({
      requestedBy: "director-1",
      corroboratedBy: "director-1",
      reason: "Some reason here",
    });
    expect(result.valid).toBe(false);
    expect(result.reasons.some((r) => r.includes("different"))).toBe(true);
  });

  it("rejects when reason is too short", () => {
    const result = validateScoreReversal({
      requestedBy: "director-1",
      corroboratedBy: "officer-1",
      reason: "too short",
    });
    expect(result.valid).toBe(false);
  });
});

describe("validateScoreCorrection", () => {
  it("accepts valid correction", () => {
    const result = validateScoreCorrection({
      correctionType: "restore_reversed_score",
      requestedBy: "director-1",
      reason: "Reversal was made in error based on incomplete review",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects invalid correction type", () => {
    const result = validateScoreCorrection({
      correctionType: "invalid_type",
      requestedBy: "director-1",
      reason: "Some valid reason that is long enough",
    });
    expect(result.valid).toBe(false);
  });
});

describe("computeNetScore", () => {
  const events = [
    { metricCategory: "pvp_kill_value" as const, pointsApproved: 10, status: "credited" as const },
    { metricCategory: "pvp_kill_value" as const, pointsApproved: 10, status: "credited" as const },
    { metricCategory: "pvp_kill_value" as const, pointsApproved: 10, status: "reversed" as const },
    { metricCategory: "fleet_participation" as const, pointsApproved: 5, status: "credited" as const },
  ];

  it("excludes reversed events", () => {
    const total = computeNetScore(events, "user-1");
    expect(total).toBe(25);
  });

  it("filters by category", () => {
    const total = computeNetScore(events, "user-1", "pvp_kill_value");
    expect(total).toBe(20);
  });
});
