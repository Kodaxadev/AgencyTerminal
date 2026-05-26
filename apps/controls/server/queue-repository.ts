import { evidence, tickets } from "../../../packages/db/schema/drizzle-schema";
import { db } from "../../../packages/db/src/client";
import { and, desc, eq, inArray } from "../../../packages/db/src/query";
import type {
  Capability,
  EvidenceQueueItemDto,
  SensitivityLevel,
  TicketQueueItemDto,
} from "../src/contracts";
import { canViewSensitivity } from "./queue-scope";

const NON_DIRECTOR_SENSITIVITY: SensitivityLevel[] = ["public", "member", "officer_only"];

export async function listIntelEvidence(
  guildId: string,
  capabilities: Capability[],
): Promise<EvidenceQueueItemDto[]> {
  const rows = await db.select().from(evidence)
    .where(and(
      eq(evidence.guildId, guildId),
      eq(evidence.metricCategory, "intelligence_acquisitions"),
      sensitivityFilter(evidence.sensitivity, capabilities),
    ))
    .orderBy(desc(evidence.createdAt))
    .limit(100);
  return rows.map(toEvidenceQueueItemDto);
}

export async function listContractTickets(
  guildId: string,
  capabilities: Capability[],
): Promise<TicketQueueItemDto[]> {
  return listTypedTickets(guildId, "contract", capabilities);
}

export async function listClearanceTickets(
  guildId: string,
  capabilities: Capability[],
): Promise<TicketQueueItemDto[]> {
  return listTypedTickets(guildId, "clearance", capabilities);
}

async function listTypedTickets(
  guildId: string,
  type: "contract" | "clearance",
  capabilities: Capability[],
): Promise<TicketQueueItemDto[]> {
  const rows = await db.select().from(tickets)
    .where(and(
      eq(tickets.guildId, guildId),
      eq(tickets.type, type),
      sensitivityFilter(tickets.sensitivity, capabilities),
    ))
    .orderBy(desc(tickets.createdAt))
    .limit(100);
  return rows.map(toTicketQueueItemDto);
}

function sensitivityFilter(column: typeof evidence.sensitivity | typeof tickets.sensitivity, capabilities: Capability[]) {
  return canViewSensitivity("director_only", capabilities)
    ? undefined
    : inArray(column, NON_DIRECTOR_SENSITIVITY);
}

function toEvidenceQueueItemDto(row: typeof evidence.$inferSelect): EvidenceQueueItemDto {
  return {
    id: row.id,
    shortId: row.shortId ?? undefined,
    title: row.title,
    metricCategory: row.metricCategory,
    status: row.status,
    sensitivity: row.sensitivity,
    submittedByDiscordId: row.submittedByDiscordId,
    subjectDiscordId: row.subjectDiscordId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toTicketQueueItemDto(row: typeof tickets.$inferSelect): TicketQueueItemDto {
  return {
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
  };
}
