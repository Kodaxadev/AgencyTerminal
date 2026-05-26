import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { outboxStatus, priorityLevel, retentionClass, sensitivityLevel } from "./enums";
import { agentScoreEvents, evidenceLinks } from "./evidence-tables";
import { guildConfig, tickets } from "./ticket-tables";

export const discordOutbox = pgTable("discord_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: outboxStatus("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  guildIdempotencyIdx: uniqueIndex("discord_outbox_guild_idempotency_key").on(table.guildId, table.idempotencyKey),
  dueIdx: index("idx_discord_outbox_due").on(table.status, table.nextAttemptAt),
}));

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").primaryKey(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  actorDiscordId: text("actor_discord_id"),
  result: jsonb("result").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (table) => ({ expiresAtIdx: index("idx_idempotency_expires_at").on(table.expiresAt) }));

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  actorDiscordId: text("actor_discord_id").notNull(),
  action: text("action").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowSeconds: integer("window_seconds").notNull(),
  count: integer("count").notNull().default(0),
  limitCount: integer("limit_count").notNull(),
}, (table) => ({ bucketIdx: uniqueIndex("rate_limit_buckets_guild_actor_action_window").on(table.guildId, table.actorDiscordId, table.action, table.windowStart) }));

export const botHealthChecks = pgTable("bot_health_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").references(() => guildConfig.guildId, { onDelete: "cascade" }),
  checkId: text("check_id").notNull(),
  status: text("status").notNull(),
  detail: text("detail"),
  remediation: text("remediation"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ guildCheckIdx: uniqueIndex("bot_health_checks_guild_check").on(table.guildId, table.checkId) }));

export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerName: text("worker_name").primaryKey(),
  guildId: text("guild_id").references(() => guildConfig.guildId, { onDelete: "cascade" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb("metadata").notNull().default({}),
});

export const controlsSessions = pgTable("controls_sessions", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  user: jsonb("user").notNull().default({}),
  discordRoleIds: jsonb("discord_role_ids").notNull().default([]),
  capabilities: jsonb("capabilities").notNull().default([]),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ expiresAtIdx: index("idx_controls_sessions_expires_at").on(table.expiresAt) }));

export const retentionPolicies = pgTable("retention_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  class: retentionClass("class").notNull(),
  retainDays: integer("retain_days"),
  action: text("action").notNull().default("retain"),
  sensitivity: sensitivityLevel("sensitivity").notNull().default("officer_only"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ guildClassIdx: uniqueIndex("retention_policies_guild_class").on(table.guildId, table.class) }));

export const ticketTranscripts = pgTable("ticket_transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "restrict" }),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  storageUrl: text("storage_url").notNull(),
  storageProvider: text("storage_provider").notNull().default("supabase"),
  sha256: text("sha256"),
  messageCount: integer("message_count").notNull().default(0),
  generatedBy: text("generated_by"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  retentionClass: retentionClass("retention_class").notNull().default("ticket_transcript"),
  deleteAfter: timestamp("delete_after", { withTimezone: true }),
}, (table) => ({ deleteAfterIdx: index("idx_ticket_transcripts_delete_after").on(table.deleteAfter) }));

export const evidenceAttachmentCopies = pgTable("evidence_attachment_copies", {
  id: uuid("id").primaryKey().defaultRandom(),
  evidenceLinkId: uuid("evidence_link_id").notNull().references(() => evidenceLinks.id, { onDelete: "cascade" }),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  storageUrl: text("storage_url").notNull(),
  storageProvider: text("storage_provider").notNull().default("supabase"),
  sha256: text("sha256"),
  copiedAt: timestamp("copied_at", { withTimezone: true }).notNull().defaultNow(),
  deleteAfter: timestamp("delete_after", { withTimezone: true }),
}, (table) => ({ deleteAfterIdx: index("idx_evidence_attachment_copies_delete_after").on(table.deleteAfter) }));

export const doctrineChallenges = pgTable("doctrine_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  submittedByDiscordId: text("submitted_by_discord_id").notNull(),
  title: text("title").notNull(),
  challengeSummary: text("challenge_summary").notNull(),
  proposedRevision: text("proposed_revision").notNull(),
  status: text("status").notNull().default("submitted"),
  adoptedScoreEventId: uuid("adopted_score_event_id").references(() => agentScoreEvents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clearanceRequests = pgTable("clearance_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
  requesterDiscordId: text("requester_discord_id").notNull(),
  requestedClearance: text("requested_clearance").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("requested"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contractDetails = pgTable("contract_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  clientName: text("client_name"),
  clientAffiliation: text("client_affiliation"),
  objective: text("objective").notNull().default(""),
  operationalWindow: text("operational_window"),
  paymentTerms: text("payment_terms"),
  riskLevel: priorityLevel("risk_level").notNull().default("medium"),
  diplomaticSensitivity: sensitivityLevel("diplomatic_sensitivity").notNull().default("officer_only"),
  retentionClass: retentionClass("retention_class").notNull().default("contract_terms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ ticketIdx: uniqueIndex("contract_details_ticket").on(table.ticketId) }));

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  actorDiscordId: text("actor_discord_id"),
  action: text("action").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  sensitivity: sensitivityLevel("sensitivity").notNull().default("officer_only"),
  payload: jsonb("payload").notNull().default({}),
  discordMessageId: text("discord_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  guildCreatedIdx: index("idx_audit_guild_created").on(table.guildId, table.createdAt),
  subjectIdx: index("idx_audit_subject").on(table.subjectType, table.subjectId),
}));
