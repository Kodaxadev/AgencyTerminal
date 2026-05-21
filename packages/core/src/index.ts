// Agency Terminal Core Types
// Canonical type definitions shared across bot, controls, and packages.

// --- Ticket System ---

export type WorkflowType =
  | "enlistment"
  | "contract"
  | "intel"
  | "performance_evidence"
  | "clearance"
  | "doctrine_challenge"
  | "general";

export type TicketLifecycleStatus =
  | "open"
  | "waiting_on_user"
  | "waiting_on_staff"
  | "escalated"
  | "resolved"
  | "archived";

export type PriorityLevel = "low" | "medium" | "high" | "critical";

// --- Evidence Ledger ---

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

export type MetricCategory =
  | "pvp_kill_value"
  | "fleet_participation"
  | "contracts_completed"
  | "intelligence_acquisitions"
  | "technical_development_output"
  | "asset_contributions"
  | "exploration"
  | "lore_discovery";

export type EvidenceSubjectRole = "primary" | "supporting" | "witness_only";

export type EvidenceWitnessType = "participant" | "observer" | "officer" | "external_source";

export type EvidenceQualityTier = "A" | "B" | "C" | "D" | "F";

export type SubmittedMode = "live_bot" | "manual_backfill" | "imported";

export type ReviewDecision = "approve" | "object" | "needs_more_evidence";

// --- Scoring ---

export type PointSource = "configured_table" | "director_override" | "manual_adjustment";

export type ScoreStatus = "credited" | "reversed";

export type ScoreCorrectionType = "restore_reversed_score" | "adjust_score_after_review";

// --- Appeals ---

export type AppealStatus = "requested" | "under_review" | "granted" | "denied" | "final";

export type AppealGround =
  | "new_evidence"
  | "procedural_error"
  | "wrong_subject"
  | "wrong_metric"
  | "wrong_points"
  | "duplicate_error"
  | "reversal_error";

// --- Clearance ---

export type ClearanceStatus =
  | "requested"
  | "reviewing"
  | "approved"
  | "denied"
  | "temporary"
  | "revoked"
  | "expired";

// --- Doctrine ---

export type DoctrineChallengeStatus =
  | "submitted"
  | "under_review"
  | "accepted_for_discussion"
  | "rejected_insufficient_evidence"
  | "adopted"
  | "deprecated";

// --- Security & Permissions ---

export type Sensitivity = "public" | "member" | "officer_only" | "director_only";

export type MetricVisibility = "public" | "officer_only";

export type Capability =
  | "can_manage_enlistment"
  | "can_manage_contracts"
  | "can_manage_intel"
  | "can_manage_clearance"
  | "can_validate_evidence"
  | "can_view_audit"
  | "can_manage_config"
  | "can_override_quorum"
  | "can_reverse_score"
  | "can_backfill_evidence"
  | "can_review_appeals";

// --- Retention ---

export type RetentionClass =
  | "ticket_channel"
  | "ticket_transcript"
  | "evidence_record"
  | "evidence_attachment_copy"
  | "audit_log"
  | "score_event"
  | "score_reversal"
  | "intel_sensitive"
  | "contract_terms"
  | "doctrine_challenge";

export type RetentionAction = "retain" | "archive" | "delete" | "redact";

// --- Health & Reliability ---

export type HealthCheckStatus = "ok" | "warn" | "fail";

export type OutboxStatus = "pending" | "processing" | "sent" | "failed" | "dead";
