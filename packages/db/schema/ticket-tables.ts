import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  capabilityEnum,
  metricCategory,
  metricVisibility,
  priorityLevel,
  sensitivityLevel,
  ticketLifecycleStatus,
  ticketStatus,
  ticketType,
  workflowTypeEnum,
} from "./enums";

export const guildConfig = pgTable("guild_config", {
  guildId: text("guild_id").primaryKey(),
  name: text("name").notNull().default("Agency Terminal"),
  adminChannelId: text("admin_channel_id"),
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
}, (table) => ({ guildCapabilityRoleIdx: uniqueIndex("role_mappings_guild_capability_role").on(table.guildId, table.capability, table.discordRoleId) }));

export const metricConfig = pgTable("metric_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: text("guild_id").notNull().references(() => guildConfig.guildId, { onDelete: "cascade" }),
  category: metricCategory("category").notNull(),
  basePoints: integer("base_points").notNull().default(1),
  visibility: metricVisibility("visibility").notNull().default("public"),
  enabled: boolean("enabled").notNull().default(true),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ guildCategoryVersionIdx: uniqueIndex("metric_config_guild_category_version").on(table.guildId, table.category, table.version) }));

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
  guildShortIdIdx: uniqueIndex("idx_tickets_guild_short_id").on(table.guildId, table.shortId),
}));

export const ticketParticipants = pgTable("ticket_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  discordId: text("discord_id").notNull(),
  role: text("role").notNull().default("participant"),
  addedBy: text("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ ticketDiscordIdx: uniqueIndex("ticket_participants_ticket_discord").on(table.ticketId, table.discordId) }));

export const ticketEvents = pgTable("ticket_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  actorDiscordId: text("actor_discord_id"),
  eventType: text("event_type").notNull(),
  eventPayload: jsonb("event_payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ ticketCreatedIdx: index("idx_ticket_events_ticket_created").on(table.ticketId, table.createdAt) }));

export const workflowInstances = pgTable("workflow_instances", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  workflowType: workflowTypeEnum("workflow_type").notNull(),
  workflowStatus: text("workflow_status").notNull(),
  statusReason: text("status_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ticketIdx: uniqueIndex("workflow_instances_ticket").on(table.ticketId),
  typeStatusIdx: index("idx_workflow_instances_type_status").on(table.workflowType, table.workflowStatus),
}));

export const workflowEvents = pgTable("workflow_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowInstanceId: uuid("workflow_instance_id").notNull().references(() => workflowInstances.id, { onDelete: "cascade" }),
  actorDiscordId: text("actor_discord_id"),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ instanceCreatedIdx: index("idx_workflow_events_instance_created").on(table.workflowInstanceId, table.createdAt) }));
