import {
  agentScoreEvents,
  auditLog,
  evidence,
  retentionPolicies,
  tickets,
} from "../../../packages/db/schema/drizzle-schema";
import { db } from "../../../packages/db/src/client";
import { desc, eq } from "../../../packages/db/src/query";
import type { ExportDescriptorDto, ExportPayloadDto, ExportType } from "../src/contracts";
import {
  buildExportPayload,
  listExportDescriptors,
  normalizeExportType,
  requireExportConfirmation,
} from "./export-service";

export function listAvailableExports(): Promise<ExportDescriptorDto[]> {
  return Promise.resolve(listExportDescriptors());
}

export async function buildExport(
  typeInput: string,
  guildId: string,
  actorDiscordId: string,
  confirmation?: string,
): Promise<ExportPayloadDto> {
  const type = normalizeExportType(typeInput);
  requireExportConfirmation(type, confirmation);
  const rows = await readExportRows(type, guildId);
  const payload = buildExportPayload(type, guildId, rows, new Date());
  await writeExportAudit(guildId, actorDiscordId, payload);
  return payload;
}

async function readExportRows(type: ExportType, guildId: string): Promise<unknown[]> {
  if (type === "ledger") return readLedgerRows(guildId);
  if (type === "agents") return db.select().from(agentScoreEvents)
    .where(eq(agentScoreEvents.guildId, guildId))
    .orderBy(desc(agentScoreEvents.creditedAt))
    .limit(500);
  if (type === "audit") return db.select().from(auditLog)
    .where(eq(auditLog.guildId, guildId))
    .orderBy(desc(auditLog.createdAt))
    .limit(1000);
  if (type === "tickets") return db.select().from(tickets)
    .where(eq(tickets.guildId, guildId))
    .orderBy(desc(tickets.createdAt))
    .limit(500);
  return db.select().from(retentionPolicies).where(eq(retentionPolicies.guildId, guildId));
}

async function readLedgerRows(guildId: string): Promise<unknown[]> {
  const [evidenceRows, scoreRows] = await Promise.all([
    db.select().from(evidence)
      .where(eq(evidence.guildId, guildId))
      .orderBy(desc(evidence.createdAt))
      .limit(500),
    db.select().from(agentScoreEvents)
      .where(eq(agentScoreEvents.guildId, guildId))
      .orderBy(desc(agentScoreEvents.creditedAt))
      .limit(500),
  ]);
  return [
    ...evidenceRows.map((row) => ({ kind: "evidence", ...row })),
    ...scoreRows.map((row) => ({ kind: "score_event", ...row })),
  ];
}

async function writeExportAudit(
  guildId: string,
  actorDiscordId: string,
  payload: ExportPayloadDto,
): Promise<void> {
  await db.insert(auditLog).values({
    guildId,
    actorDiscordId,
    action: "controls_export_created",
    subjectType: "export",
    subjectId: payload.type,
    sensitivity: "officer_only",
    payload: {
      generatedAt: payload.generatedAt,
      recordCount: payload.recordCount,
      sensitivity: payload.sensitivity,
    },
  });
}
