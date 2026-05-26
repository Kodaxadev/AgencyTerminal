import {
  auditLog,
  botHealthChecks,
  discordOutbox,
  evidence,
  guildConfig,
  metricConfig,
  roleMappings,
  tickets,
  workerHeartbeats,
} from "../../../packages/db/schema/drizzle-schema";
import { db } from "../../../packages/db/src/client";
import { and, desc, eq, inArray, sql } from "../../../packages/db/src/query";
import { buildGuildConfigValues, toGuildConfigDto } from "./config-view";
import { buildExport, listAvailableExports } from "./export-repository";
import { buildOperationalHealthChecks } from "./health-view";
import { listClearanceTickets, listContractTickets, listIntelEvidence } from "./queue-repository";
import { dryRunRetention, listRetentionPolicies, runRetention, saveRetentionPolicy } from "./retention-repository";
import type {
  AuditLogDto,
  Capability,
  ExportDescriptorDto,
  ExportPayloadDto,
  ExportType,
  GuildConfigDto,
  HealthCheckDto,
  MetricConfigDto,
  OverviewDto,
  RetentionDryRunDto,
  RetentionPolicyDto,
  RetentionPolicyInput,
  RetentionRunDto,
  RoleCapabilityMapping,
  RoleMappingDto,
  EvidenceQueueItemDto,
  TicketQueueItemDto,
} from "../src/contracts";

export interface ControlsRepository {
  listRoleCapabilityMappings(guildId: string): Promise<RoleCapabilityMapping[]>;
  getOverview(guildId: string, env: NodeJS.ProcessEnv): Promise<OverviewDto>;
  listHealth(guildId: string, env: NodeJS.ProcessEnv): Promise<HealthCheckDto[]>;
  getGuildConfig(guildId: string): Promise<GuildConfigDto>;
  saveGuildConfig(input: GuildConfigDto, actorDiscordId: string): Promise<GuildConfigDto>;
  listRoleMappings(guildId: string): Promise<RoleMappingDto[]>;
  createRoleMapping(input: RoleCapabilityMapping & { guildId: string }, actorDiscordId: string): Promise<RoleMappingDto>;
  deleteRoleMapping(guildId: string, id: string, actorDiscordId: string): Promise<void>;
  listMetrics(guildId: string): Promise<MetricConfigDto[]>;
  createMetricVersion(input: Omit<MetricConfigDto, "id" | "version"> & { guildId: string }, actorDiscordId: string): Promise<MetricConfigDto>;
  listRetentionPolicies(guildId: string): Promise<RetentionPolicyDto[]>;
  saveRetentionPolicy(input: RetentionPolicyInput & { guildId: string }, actorDiscordId: string): Promise<RetentionPolicyDto>;
  dryRunRetention(guildId: string): Promise<RetentionDryRunDto>;
  runRetention(guildId: string, dryRunToken: string, actorDiscordId: string, confirmation: string): Promise<RetentionRunDto>;
  listAvailableExports(): Promise<ExportDescriptorDto[]>;
  buildExport(type: ExportType | string, guildId: string, actorDiscordId: string, confirmation?: string): Promise<ExportPayloadDto>;
  listIntelEvidence(guildId: string, capabilities: Capability[]): Promise<EvidenceQueueItemDto[]>;
  listContractTickets(guildId: string, capabilities: Capability[]): Promise<TicketQueueItemDto[]>;
  listClearanceTickets(guildId: string, capabilities: Capability[]): Promise<TicketQueueItemDto[]>;
  listEvidenceQueue(guildId: string): Promise<EvidenceQueueItemDto[]>;
  listTickets(guildId: string): Promise<TicketQueueItemDto[]>;
  listAudit(guildId: string): Promise<AuditLogDto[]>;
  writeAudit(input: { guildId: string; actorDiscordId: string; action: string; subjectType: string; subjectId: string; payload?: Record<string, unknown> }): Promise<void>;
}

export function createControlsRepository(): ControlsRepository {
  return {
    listRoleCapabilityMappings,
    getOverview,
    listHealth,
    getGuildConfig,
    saveGuildConfig,
    listRoleMappings,
    createRoleMapping,
    deleteRoleMapping,
    listMetrics,
    createMetricVersion,
    listRetentionPolicies,
    saveRetentionPolicy,
    dryRunRetention,
    runRetention,
    listAvailableExports,
    buildExport,
    listIntelEvidence,
    listContractTickets,
    listClearanceTickets,
    listEvidenceQueue,
    listTickets,
    listAudit,
    writeAudit,
  };
}

async function getGuildConfig(guildId: string): Promise<GuildConfigDto> {
  const rows = await db.select().from(guildConfig).where(eq(guildConfig.guildId, guildId)).limit(1);
  const row = rows[0];
  return row ? toGuildConfigDto(row) : {
    guildId,
    name: "Agency Terminal",
    staleReviewHours: 48,
  };
}

async function saveGuildConfig(input: GuildConfigDto, actorDiscordId: string): Promise<GuildConfigDto> {
  const values = buildGuildConfigValues(input, new Date());
  const [row] = await db.insert(guildConfig).values(values).onConflictDoUpdate({
    target: guildConfig.guildId,
    set: values,
  }).returning();
  await writeConfigAudit(input.guildId, actorDiscordId, "controls_config_saved", "guild_config", input.guildId);
  return toGuildConfigDto(row);
}

async function listRoleCapabilityMappings(guildId: string): Promise<RoleCapabilityMapping[]> {
  const rows = await db.select({
    discordRoleId: roleMappings.discordRoleId,
    capability: roleMappings.capability,
  }).from(roleMappings).where(eq(roleMappings.guildId, guildId));
  return rows.map((row) => ({
    discordRoleId: row.discordRoleId,
    capability: row.capability,
  }));
}

async function listRoleMappings(guildId: string): Promise<RoleMappingDto[]> {
  const rows = await db.select().from(roleMappings).where(eq(roleMappings.guildId, guildId));
  return rows.map(toRoleMappingDto);
}

async function createRoleMapping(
  input: RoleCapabilityMapping & { guildId: string },
  actorDiscordId: string,
): Promise<RoleMappingDto> {
  const [row] = await db.insert(roleMappings).values({
    guildId: input.guildId,
    discordRoleId: input.discordRoleId,
    capability: input.capability,
  }).returning();
  await writeConfigAudit(input.guildId, actorDiscordId, "controls_role_mapping_created", "role_mapping", row.id);
  return toRoleMappingDto(row);
}

async function deleteRoleMapping(guildId: string, id: string, actorDiscordId: string): Promise<void> {
  const rows = await db.delete(roleMappings)
    .where(and(eq(roleMappings.guildId, guildId), eq(roleMappings.id, id)))
    .returning({ id: roleMappings.id });
  if (rows.length === 0) throw new Error("Role mapping not found");
  await writeConfigAudit(guildId, actorDiscordId, "controls_role_mapping_deleted", "role_mapping", id);
}

async function listMetrics(guildId: string): Promise<MetricConfigDto[]> {
  const rows = await db.select().from(metricConfig).where(eq(metricConfig.guildId, guildId));
  return rows.map(toMetricDto);
}

async function createMetricVersion(
  input: Omit<MetricConfigDto, "id" | "version"> & { guildId: string },
  actorDiscordId: string,
): Promise<MetricConfigDto> {
  const latest = await db.select({ version: sql<number>`coalesce(max(${metricConfig.version}), 0)` })
    .from(metricConfig)
    .where(and(eq(metricConfig.guildId, input.guildId), eq(metricConfig.category, input.category as typeof metricConfig.$inferInsert.category)));
  const nextVersion = Number(latest[0]?.version ?? 0) + 1;
  const [row] = await db.insert(metricConfig).values({
    guildId: input.guildId,
    category: input.category as typeof metricConfig.$inferInsert.category,
    basePoints: input.basePoints,
    visibility: input.visibility as typeof metricConfig.$inferInsert.visibility,
    enabled: input.enabled,
    version: nextVersion,
  }).returning();
  await writeConfigAudit(input.guildId, actorDiscordId, "controls_metric_version_created", "metric_config", row.id);
  return toMetricDto(row);
}

async function listAudit(guildId: string): Promise<AuditLogDto[]> {
  const rows = await db.select().from(auditLog)
    .where(eq(auditLog.guildId, guildId))
    .orderBy(desc(auditLog.createdAt))
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    actorDiscordId: row.actorDiscordId ?? undefined,
    action: row.action,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    sensitivity: row.sensitivity,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function listEvidenceQueue(guildId: string): Promise<EvidenceQueueItemDto[]> {
  const rows = await db.select().from(evidence)
    .where(eq(evidence.guildId, guildId))
    .orderBy(desc(evidence.createdAt))
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    shortId: row.shortId ?? undefined,
    title: row.title,
    metricCategory: row.metricCategory,
    status: row.status,
    sensitivity: row.sensitivity,
    submittedByDiscordId: row.submittedByDiscordId,
    subjectDiscordId: row.subjectDiscordId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function listTickets(guildId: string): Promise<TicketQueueItemDto[]> {
  const rows = await db.select().from(tickets)
    .where(eq(tickets.guildId, guildId))
    .orderBy(desc(tickets.createdAt))
    .limit(100);
  return rows.map((row) => ({
    id: row.id,
    shortId: row.shortId ?? undefined,
    channelId: row.channelId,
    type: row.type,
    status: row.status,
    lifecycleStatus: row.lifecycleStatus,
    priority: row.priority,
    sensitivity: row.sensitivity,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
  }));
}

async function listHealth(guildId: string, env: NodeJS.ProcessEnv): Promise<HealthCheckDto[]> {
  const now = new Date().toISOString();
  const envChecks = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DATABASE_URL"].map((key) => ({
    id: key,
    label: key,
    status: env[key] ? "ok" as const : "fail" as const,
    lastCheckedAt: now,
    detail: env[key] ? "Configured" : "Missing",
  }));
  const [rows, heartbeatRows, outboxPending, outboxDead] = await Promise.all([
    db.select().from(botHealthChecks).where(eq(botHealthChecks.guildId, guildId)),
    db.select().from(workerHeartbeats).where(eq(workerHeartbeats.guildId, guildId)),
    countRows(discordOutbox, and(eq(discordOutbox.guildId, guildId), inArray(discordOutbox.status, ["pending", "processing", "failed"]))),
    countRows(discordOutbox, and(eq(discordOutbox.guildId, guildId), eq(discordOutbox.status, "dead"))),
  ]);
  const dbChecks = rows.map((row) => ({
    id: row.checkId,
    label: row.checkId,
    status: row.status as HealthCheckDto["status"],
    lastCheckedAt: row.checkedAt.toISOString(),
    detail: row.detail ?? undefined,
    remediation: row.remediation ?? undefined,
  }));
  const operationalChecks = buildOperationalHealthChecks({
    guildId,
    now: new Date(now),
    outboxPending,
    outboxDead,
    workerHeartbeats: heartbeatRows,
    env,
  });
  return [...envChecks, ...operationalChecks, ...dbChecks];
}

async function getOverview(guildId: string, env: NodeJS.ProcessEnv): Promise<OverviewDto> {
  const [guild, health, openTickets, staleEvidence, pendingQuorum, outboxPending, outboxDead] = await Promise.all([
    getGuildConfig(guildId),
    listHealth(guildId, env),
    countRows(tickets, and(eq(tickets.guildId, guildId), inArray(tickets.lifecycleStatus, ["open", "escalated"]))),
    countRows(evidence, and(eq(evidence.guildId, guildId), eq(evidence.status, "stale_review"))),
    countRows(evidence, and(eq(evidence.guildId, guildId), eq(evidence.status, "under_review"))),
    countRows(discordOutbox, and(eq(discordOutbox.guildId, guildId), inArray(discordOutbox.status, ["pending", "processing", "failed"]))),
    countRows(discordOutbox, and(eq(discordOutbox.guildId, guildId), eq(discordOutbox.status, "dead"))),
  ]);
  const statusCode = health.some((check) => check.status === "fail") ? 503 : health.some((check) => check.status === "warn") ? 206 : 200;
  return {
    statusCode,
    statusLabel: statusCode === 200 ? "OPERATIONAL" : statusCode === 206 ? "DEGRADED" : "ACTION REQUIRED",
    guild,
    health,
    counts: {
      openTickets,
      staleEvidence,
      pendingQuorum,
      failedDiscordProjections: outboxDead,
      outboxPending,
      outboxDead,
    },
  };
}

async function writeAudit(input: { guildId: string; actorDiscordId: string; action: string; subjectType: string; subjectId: string; payload?: Record<string, unknown> }): Promise<void> {
  await db.insert(auditLog).values({ ...input, sensitivity: "officer_only" });
}

async function writeConfigAudit(guildId: string, actorDiscordId: string, action: string, subjectType: string, subjectId: string): Promise<void> {
  await writeAudit({ guildId, actorDiscordId, action, subjectType, subjectId });
}

async function countRows(table: typeof tickets | typeof evidence | typeof discordOutbox, where: ReturnType<typeof and>): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(table).where(where);
  return Number(rows[0]?.count ?? 0);
}

function toRoleMappingDto(row: typeof roleMappings.$inferSelect): RoleMappingDto {
  return {
    id: row.id,
    guildId: row.guildId,
    capability: row.capability,
    discordRoleId: row.discordRoleId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMetricDto(row: typeof metricConfig.$inferSelect): MetricConfigDto {
  return {
    id: row.id,
    category: row.category,
    basePoints: row.basePoints,
    visibility: row.visibility,
    enabled: row.enabled,
    version: row.version,
  };
}
