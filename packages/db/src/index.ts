// @agency-terminal/db
// Drizzle ORM client backed by PostgreSQL via postgres-js.
// DATABASE_URL must be set in the environment before importing.

export { closeDbPool, db, pool } from "./client";
export * from "../schema/drizzle-schema";
export { createTicket } from "./tickets";
export type { CreateTicketInput, CreateTicketResult, TicketType } from "./tickets";
export { submitEvidence, addReview, creditScore, writeAuditLog, findStaleEvidence, markEvidenceStale, directorOverrideEvidence } from "./evidence";
export type {
  SubmitEvidenceInput,
  SubmitEvidenceResult,
  AddReviewInput,
  AddReviewResult,
  CreditScoreInput,
} from "./evidence";
export { getEvidenceStatusForParticipant } from "./evidence-status";
export type {
  EvidenceStatusLookupInput,
  EvidenceStatusResult,
} from "./evidence-status";
export {
  enqueueOutbox,
  fetchDueOutbox,
  claimDueOutbox,
  markOutboxSent,
  markOutboxFailed,
  recoverAbandonedOutboxClaims,
  createTicketChannel,
  persistTicketChannelId,
} from "./outbox";
export type {
  EnqueueOutboxInput,
  OutboxEventType,
  CreateTicketChannelInput,
  RecoverAbandonedOutboxClaimsResult,
} from "./outbox";
export { getCapabilitiesForRoles, getRoleIdsForCapabilities } from "./permissions";
export type { Capability } from "./permissions";
export { getLatestMetricConfig } from "./metric-config";
export { recordWorkerHeartbeat } from "./worker-heartbeats";
export type { RecordWorkerHeartbeatInput } from "./worker-heartbeats";
