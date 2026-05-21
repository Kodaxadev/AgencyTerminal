// @agency-terminal/db
// Drizzle ORM client backed by PostgreSQL via postgres-js.
// DATABASE_URL must be set in the environment before importing.

export { db, pool } from "./client";
export * from "../schema/drizzle-schema";
export { createTicket } from "./tickets";
export type { CreateTicketInput, CreateTicketResult, TicketType } from "./tickets";
export { submitEvidence, addReview, creditScore, writeAuditLog } from "./evidence";
export type {
  SubmitEvidenceInput,
  SubmitEvidenceResult,
  AddReviewInput,
  AddReviewResult,
  CreditScoreInput,
} from "./evidence";
export {
  enqueueOutbox,
  fetchDueOutbox,
  markOutboxSent,
  markOutboxFailed,
  createTicketChannel,
} from "./outbox";
export type { EnqueueOutboxInput, OutboxEventType, CreateTicketChannelInput } from "./outbox";
