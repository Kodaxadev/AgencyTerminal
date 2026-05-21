// Agency Terminal Drizzle schema sketch.
// This mirrors the SQL migrations enough to start implementation.
// Keep migrations as the canonical source until the repo chooses Drizzle or Prisma.

import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  unique,
  index,
} from "drizzle-orm/pg-core";

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

export const priorityLevel = pgEnum("priority_level", ["low", "medium", "high", "critical"]);
export const sensitivityLevel = pgEnum("sensitivity_level", ["public", "member", "officer_only", "director_only"]);

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

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  channelId: text("channel_id").notNull().unique(),
  creatorDiscordId: text("creator_discord_id").notNull(),
  assignedDiscordId: text("assigned_discord_id"),
  type: ticketType("type").notNull(),
  status: ticketStatus("status").notNull().default("submitted"),
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

export const evidence = pgTable("evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
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
