// Evidence interfaces — type unions are defined inline.
// The package index re-exports the same type unions for consumers.

// --- Type unions ---

export type MetricCategory =
  | "pvp_kill_value"
  | "fleet_participation"
  | "contracts_completed"
  | "intelligence_acquisitions"
  | "technical_development_output"
  | "asset_contributions"
  | "exploration"
  | "lore_discovery";

export type EvidenceStatus =
  | "submitted"
  | "under_review"
  | "stale_review"
  | "needs_more_evidence"
  | "validated"
  | "rejected"
  | "duplicate"
  | "credited"
  | "reversed";

export type EvidenceSubjectRole = "primary" | "supporting" | "witness_only";
export type EvidenceWitnessType = "participant" | "observer" | "officer" | "external_source";
export type EvidenceQualityTier = "A" | "B" | "C" | "D" | "F";
export type SubmittedMode = "live_bot" | "manual_backfill" | "imported";
export type ReviewDecision = "approve" | "object" | "needs_more_evidence";
export type Sensitivity = "public" | "member" | "officer_only" | "director_only";

// --- Evidence Record ---

export interface EvidenceRecord {
  id: string;
  guildId: string;
  ticketId?: string;
  submittedByDiscordId: string;
  subjectDiscordId: string;
  metricCategory: MetricCategory;
  status: EvidenceStatus;
  sensitivity: Sensitivity;
  title: string;
  description: string;
  validationRequiredApprovals: number;
  staleAfter?: Date;
  staleNotifiedAt?: Date;
  validatedAt?: Date;
  rejectedAt?: Date;
  creditedAt?: Date;
  eventOccurredAt?: Date;
  submittedMode: SubmittedMode;
  createdAt: Date;
  updatedAt: Date;
}

// --- Evidence Subjects (group credit) ---

export interface EvidenceSubject {
  evidenceId: string;
  subjectDiscordId: string;
  role: EvidenceSubjectRole;
  pointMultiplier: number;
  note?: string;
}

// --- Evidence Witnesses ---

export interface EvidenceWitness {
  evidenceId: string;
  witnessDiscordId?: string;
  witnessType: EvidenceWitnessType;
  statement?: string;
  externalReference?: string;
}

// --- Evidence Links ---

export interface EvidenceLink {
  evidenceId: string;
  url: string;
  sourceType: EvidenceSourceType;
  parsed: boolean;
  parsedSummary: Record<string, unknown>;
}

export type EvidenceSourceType =
  | "killboard"
  | "screenshot"
  | "discord_message"
  | "transaction_digest"
  | "world_api"
  | "manual"
  | "signal_vault";

// --- Review Records ---

export interface ReviewRecord {
  evidenceId: string;
  reviewerDiscordId: string;
  decision: ReviewDecision;
  rationale: string;
  qualityTier?: EvidenceQualityTier;
  conflictDisclosed: boolean;
  conflictReason?: string;
  createdAt: Date;
}

// --- Metric Config ---

export interface MetricConfig {
  category: MetricCategory;
  basePoints: number;
  visibility: "public" | "officer_only";
  enabled: boolean;
  version: number;
}

// --- Idempotency ---

export type IdempotencyKey = string;
