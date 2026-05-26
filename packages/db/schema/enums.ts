import { pgEnum } from "drizzle-orm/pg-core";

export const ticketType = pgEnum("ticket_type", [
  "enlistment",
  "contract",
  "intel",
  "performance_evidence",
  "clearance",
  "doctrine_challenge",
  "general",
]);

export const ticketStatus = pgEnum("ticket_status", [
  "submitted",
  "screening",
  "under_review",
  "waiting_on_user",
  "waiting_on_staff",
  "accepted",
  "denied",
  "validated",
  "rejected",
  "active",
  "completed",
  "archived",
]);

export const ticketLifecycleStatus = pgEnum("ticket_lifecycle_status", [
  "open",
  "waiting_on_user",
  "waiting_on_staff",
  "escalated",
  "resolved",
  "archived",
]);

export const workflowTypeEnum = pgEnum("workflow_type", [
  "enlistment",
  "contract",
  "intel",
  "performance_evidence",
  "clearance",
  "doctrine_challenge",
  "general",
]);

export const priorityLevel = pgEnum("priority_level", ["low", "medium", "high", "critical"]);
export const sensitivityLevel = pgEnum("sensitivity_level", ["public", "member", "officer_only", "director_only"]);
export const metricVisibility = pgEnum("metric_visibility", ["public", "officer_only"]);

export const retentionClass = pgEnum("retention_class", [
  "ticket_channel",
  "ticket_transcript",
  "evidence_record",
  "evidence_attachment_copy",
  "audit_log",
  "score_event",
  "score_reversal",
  "intel_sensitive",
  "contract_terms",
  "doctrine_challenge",
]);

export const retentionAction = pgEnum("retention_action", [
  "retain",
  "archive",
  "delete",
  "redact",
]);

export const metricCategory = pgEnum("metric_category", [
  "pvp_kill_value",
  "fleet_participation",
  "contracts_completed",
  "intelligence_acquisitions",
  "technical_development_output",
  "asset_contributions",
  "exploration",
  "lore_discovery",
]);

export const evidenceStatus = pgEnum("evidence_status", [
  "submitted",
  "under_review",
  "stale_review",
  "needs_more_evidence",
  "validated",
  "rejected",
  "duplicate",
  "credited",
  "reversed",
]);

export const reviewDecision = pgEnum("review_decision", [
  "approve",
  "object",
  "needs_more_evidence",
]);

export const scoreStatus = pgEnum("score_status", ["credited", "reversed"]);
export const pointSource = pgEnum("point_source", [
  "configured_table",
  "director_override",
  "manual_adjustment",
]);

export const capabilityEnum = pgEnum("capability", [
  "can_view_all_tickets",
  "can_validate_evidence",
  "can_override_quorum",
  "can_reverse_score",
  "can_manage_clearance",
  "can_manage_contracts",
  "can_manage_intel",
  "can_manage_config",
  "can_manage_enlistment",
  "can_view_audit",
  "can_view_sensitive_contracts",
  "can_view_sensitive_intel",
  "can_backfill_evidence",
  "can_review_appeals",
]);

export const outboxStatus = pgEnum("outbox_status", ["pending", "processing", "sent", "failed", "dead"]);
export const submittedModeEnum = pgEnum("submitted_mode", ["live_bot", "manual_backfill", "imported"]);
export const evidenceQualityTier = pgEnum("evidence_quality_tier", ["A", "B", "C", "D", "F"]);
export const scoreCorrectionType = pgEnum("score_correction_type", ["restore_reversed_score", "adjust_score_after_review"]);
export const evidenceSubjectRole = pgEnum("evidence_subject_role", ["primary", "supporting", "witness_only"]);
export const evidenceWitnessType = pgEnum("evidence_witness_type", ["participant", "observer", "officer", "external_source"]);
export const appealStatus = pgEnum("appeal_status", ["requested", "under_review", "granted", "denied", "final"]);
export const appealGround = pgEnum("appeal_ground", [
  "new_evidence",
  "procedural_error",
  "wrong_subject",
  "wrong_metric",
  "wrong_points",
  "duplicate_error",
  "reversal_error",
]);
