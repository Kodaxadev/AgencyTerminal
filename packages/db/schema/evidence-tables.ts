import { index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, boolean } from "drizzle-orm/pg-core";
import {
  appealGround,
  appealStatus,
  evidenceQualityTier,
  evidenceStatus,
  evidenceSubjectRole,
  evidenceWitnessType,
  metricCategory,
  pointSource,
  reviewDecision,
  scoreCorrectionType,
  scoreStatus,
  sensitivityLevel,
  submittedModeEnum,
} from "./enums";
import { guildConfig, tickets } from "./ticket-tables";

export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  shortId: text("short_id"),
  submittedByDiscordId: text("submitted_by_discord_id").notNull(),
  subjectDiscordId: text("subject_discord_id"),
  metricCategory: metricCategory("metric_category").notNull(),
  status: evidenceStatus("status").notNull().default("submitted"),
  sensitivity: sensitivityLevel("sensitivity").notNull().default("member"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  validationRequiredApprovals: integer("validation_required_approvals").notNull().default(2),
  eventOccurredAt: timestamp("event_occurred_at", { withTimezone: true }),
  submittedMode: submittedModeEnum("submitted_mode").notNull().default("live_bot"),
  backfillReason: text("backfill_reason"),
  backfilledBy: text("backfilled_by"),
  qualityTier: evidenceQualityTier("quality_tier"),
  staleAfter: timestamp("stale_after", { withTimezone: true }),
  staleNotifiedAt: timestamp("stale_notified_at", { withTimezone: true }),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  creditedAt: timestamp("credited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  guildStatusIdx: index("idx_evidence_guild_status").on(table.guildId, table.status),
  guildShortIdIdx: uniqueIndex("idx_evidence_guild_short_id").on(table.guildId, table.shortId),
}));

export const evidenceLinks = pgTable("evidence_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sourceType: text("source_type").notNull(),
  parsed: text("parsed").notNull().default("false"),
  parsedSummary: jsonb("parsed_summary").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const evidenceReviews = pgTable("evidence_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
  reviewerDiscordId: text("reviewer_discord_id").notNull(),
  decision: reviewDecision("decision").notNull(),
  rationale: text("rationale").notNull().default(""),
  conflictDisclosed: boolean("conflict_disclosed").notNull().default(false),
  conflictReason: text("conflict_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ evidenceReviewerIdx: uniqueIndex("evidence_reviews_evidence_reviewer").on(table.evidenceId, table.reviewerDiscordId), evidenceIdx: index("idx_evidence_reviews_evidence").on(table.evidenceId) }));

export const evidenceSubjects = pgTable("evidence_subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
  subjectDiscordId: text("subject_discord_id").notNull(),
  role: evidenceSubjectRole("role").notNull().default("primary"),
  pointMultiplier: numeric("point_multiplier", { precision: 6, scale: 3 }).notNull().default("1.0"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  evidenceSubjectIdx: uniqueIndex("evidence_subjects_evidence_subject").on(table.evidenceId, table.subjectDiscordId),
  subjectIdx: index("idx_evidence_subjects_subject").on(table.subjectDiscordId),
  evidenceIdx: index("idx_evidence_subjects_evidence").on(table.evidenceId),
}));

export const evidenceWitnesses = pgTable("evidence_witnesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
  witnessDiscordId: text("witness_discord_id"),
  witnessType: evidenceWitnessType("witness_type").notNull().default("participant"),
  statement: text("statement"),
  externalReference: text("external_reference"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ evidenceIdx: index("idx_evidence_witnesses_evidence").on(table.evidenceId) }));

export const evidenceAppeals = pgTable("evidence_appeals", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").notNull(),
  status: appealStatus("status").notNull().default("requested"),
  ground: appealGround("ground").notNull(),
  explanation: text("explanation").notNull(),
  requestedOutcome: text("requested_outcome").notNull(),
  reviewerDiscordId: text("reviewer_discord_id"),
  outcomeReason: text("outcome_reason"),
  final: boolean("final").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
}, (table) => ({ evidenceIdx: index("idx_evidence_appeals_evidence").on(table.evidenceId), statusIdx: index("idx_evidence_appeals_status").on(table.status) }));

export const agentScoreEvents = pgTable("agent_score_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "restrict" }),
  agentDiscordId: text("agent_discord_id").notNull(),
  characterName: text("character_name"),
  walletAddress: text("wallet_address"),
  metricCategory: metricCategory("metric_category").notNull(),
  pointSource: pointSource("point_source").notNull().default("configured_table"),
  pointsApproved: integer("points_approved").notNull(),
  pointsTableVersion: integer("points_table_version").notNull().default(1),
  creditedBy: text("credited_by").notNull(),
  creditedAt: timestamp("credited_at", { withTimezone: true }).notNull().defaultNow(),
  status: scoreStatus("status").notNull().default("credited"),
  reversalReason: text("reversal_reason"),
}, (table) => ({
  agentIdx: index("idx_agent_score_events_agent").on(table.guildId, table.agentDiscordId),
  metricIdx: index("idx_agent_score_events_metric").on(table.guildId, table.metricCategory),
}));

export const scoreReversals = pgTable("score_reversals", {
  id: uuid("id").primaryKey().defaultRandom(),
  scoreEventId: uuid("score_event_id").notNull().references(() => agentScoreEvents.id, { onDelete: "restrict" }),
  requestedBy: text("requested_by").notNull(),
  corroboratedBy: text("corroborated_by").notNull(),
  reason: text("reason").notNull(),
  evidenceUrl: text("evidence_url"),
  auditMessageId: text("audit_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ scoreEventIdx: uniqueIndex("score_reversals_score_event").on(table.scoreEventId) }));

export const scoreCorrections = pgTable("score_corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  scoreEventId: uuid("score_event_id").notNull().references(() => agentScoreEvents.id, { onDelete: "restrict" }),
  reversalId: uuid("reversal_id").references(() => scoreReversals.id, { onDelete: "restrict" }),
  correctionType: scoreCorrectionType("correction_type").notNull(),
  requestedBy: text("requested_by").notNull(),
  corroboratedBy: text("corroborated_by").notNull(),
  reason: text("reason").notNull(),
  restoredScoreEventId: uuid("restored_score_event_id").references(() => agentScoreEvents.id, { onDelete: "restrict" }),
  auditMessageId: text("audit_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ scoreEventIdx: index("idx_score_corrections_score_event").on(table.scoreEventId) }));
