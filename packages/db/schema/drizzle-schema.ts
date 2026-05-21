// Agency Terminal Drizzle schema — mirrors SQL migrations 001-007.
// Migrations are the canonical source. Keep this in sync.

import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  pgEnum,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------

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

export const priorityLevel = pgEnum("priority_level", ["low", "medium", "high", "critical"]);
export const sensitivityLevel = pgEnum("sensitivity_level", ["public", "member", "officer_only", "director_only"]);
export const metricVisibility = pgEnum("metric_visibility", ["public", "officer_only"]);

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
]);

// ---------- Guild configuration ----------

export const guildConfig = pgTable("guild_config", {
  guildId: text("guild_id").primaryKey(),
  name: text("name").notNull().default("Agency Terminal"),
  auditChannelId: text("audit_channel_id"),
  opsQueueChannelId: text("ops_queue_channel_id"),
  archiveChannelId: text("archive_channel_id"),
  doctrineChangesChannelId: text("doctrine_changes_channel_id"),
  staleReviewHours: integer("stale_review_hours").notNull().default(48),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roleMappings = pgTable("role_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  capability: capabilityEnum("capability").notNull(),
  discordRoleId: text("discord_role_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const metricConfig = pgTable("metric_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  category: metricCategory("category").notNull(),
  basePoints: integer("base_points").notNull().default(1),
  visibility: metricVisibility("visibility").notNull().default("public"),
  enabled: text("enabled").notNull().default("true"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Ticket system ----------

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().unique(),
  shortId: text("short_id"),
  creatorDiscordId: text("creator_discord_id").notNull(),
  assignedDiscordId: text("assigned_discord_id"),
  type: ticketType("type").notNull(),
  status: ticketStatus("status").notNull().default("submitted"),
  lifecycleStatus: ticketLifecycleStatus("lifecycle_status").notNull().default("open"),
  priority: priorityLevel("priority").notNull().default("medium"),
  sensitivity: sensitivityLevel("sensitivity").notNull().default("member"),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  characterName: text("character_name"),
  walletAddress: text("wallet_address"),
  tribeName: text("tribe_name"),
  systemName: text("system_name"),
  smartObjectId: text("smart_object_id"),
  targetName: text("target_name"),
  targetTribe: text("target_tribe"),
  contractType: text("contract_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
}, (table) => ({
  guildStatusIdx: index("idx_tickets_guild_status").on(table.guildId, table.status),
  typeStatusIdx: index("idx_tickets_type_status").on(table.type, table.status),
}));

export const ticketParticipants = pgTable("ticket_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  discordId: text("discord_id").notNull(),
  role: text("role").notNull().default("participant"),
  addedBy: text("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketEvents = pgTable("ticket_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  actorDiscordId: text("actor_discord_id"),
  eventType: text("event_type").notNull(),
  eventPayload: jsonb("event_payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Workflow state machines ----------

export const workflowInstances = pgTable("workflow_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  workflowType: workflowTypeEnum("workflow_type").notNull(),
  workflowStatus: text("workflow_status").notNull(),
  statusReason: text("status_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowInstanceId: uuid("workflow_instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
  actorDiscordId: text("actor_discord_id"),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Evidence ledger ----------

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
  staleAfter: timestamp("stale_after", { withTimezone: true }),
  staleNotifiedAt: timestamp("stale_notified_at", { withTimezone: true }),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  creditedAt: timestamp("credited_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Score events and reversals ----------

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
});

export const scoreReversals = pgTable("score_reversals", {
  id: uuid("id").primaryKey().defaultRandom(),
  scoreEventId: uuid("score_event_id").notNull().references(() => agentScoreEvents.id, { onDelete: "restrict" }),
  requestedBy: text("requested_by").notNull(),
  corroboratedBy: text("corroborated_by").notNull(),
  reason: text("reason").notNull(),
  evidenceUrl: text("evidence_url"),
  auditMessageId: text("audit_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Audit log ----------

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
});
