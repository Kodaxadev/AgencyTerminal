import { describe, expect, it } from "vitest";
import {
  getEvidenceEventTicketId,
  getEvidenceIdempotencyResult,
  shouldPersistTicketChannelId,
  validateMigration007SchemaShape,
} from "../integrity";
import {
  botHealthChecks,
  capabilityEnum,
  clearanceRequests,
  contractDetails,
  controlsSessions,
  doctrineChallenges,
  evidence,
  evidenceAppeals,
  evidenceAttachmentCopies,
  evidenceReviews,
  evidenceSubjects,
  evidenceWitnesses,
  metricConfig,
  rateLimitBuckets,
  retentionPolicies,
  roleMappings,
  scoreCorrections,
  scoreReversals,
  ticketParticipants,
  ticketTranscripts,
  workflowInstances,
} from "../../schema/drizzle-schema";

type IndexConfig = {
  config?: {
    unique?: boolean;
    columns?: Array<{ name?: string }>;
  };
};

function getExtraConfigIndexes(table: object): Array<{ unique: boolean; columns: string[] }> {
  const symbols = Object.getOwnPropertySymbols(table);
  const builderSymbol = symbols.find((symbol) => String(symbol) === "Symbol(drizzle:ExtraConfigBuilder)");
  const columnsSymbol = symbols.find((symbol) => String(symbol) === "Symbol(drizzle:ExtraConfigColumns)");
  if (!builderSymbol || !columnsSymbol) return [];

  const tableRecord = table as Record<symbol, unknown>;
  const builder = tableRecord[builderSymbol];
  const columns = tableRecord[columnsSymbol];
  if (typeof builder !== "function" || typeof columns !== "object" || columns === null) return [];

  const config = builder(columns) as Record<string, IndexConfig>;
  return Object.values(config).map((entry) => ({
    unique: entry.config?.unique === true,
    columns: entry.config?.columns?.map((column) => column.name ?? "") ?? [],
  }));
}

function hasUniqueIndex(table: object, columns: string[]): boolean {
  return getExtraConfigIndexes(table).some((indexConfig) =>
    indexConfig.unique &&
    indexConfig.columns.length === columns.length &&
    indexConfig.columns.every((column, index) => column === columns[index]),
  );
}

function expectColumns(table: object, columns: string[]): void {
  const actualColumns = Object.keys(table);
  for (const column of columns) {
    expect(actualColumns).toContain(column);
  }
}

describe("DB integrity helpers", () => {
  it("does not use standalone evidence ids as ticket event foreign keys", () => {
    expect(getEvidenceEventTicketId(undefined, "evidence-uuid")).toBeNull();
  });

  it("uses the actual ticket id for ticket-scoped evidence events", () => {
    expect(getEvidenceEventTicketId("ticket-uuid", "evidence-uuid")).toBe("ticket-uuid");
  });

  it("returns the exact idempotent evidence result from stored payload", () => {
    expect(
      getEvidenceIdempotencyResult({
        evidenceId: "ev-2",
        evidenceShortId: "EVD-0002",
        validationRequiredApprovals: 1,
      }),
    ).toEqual({ id: "ev-2", shortId: "EVD-0002", validationRequiredApprovals: 1 });
  });

  it("rejects idempotency payloads missing the canonical quorum value", () => {
    expect(
      getEvidenceIdempotencyResult({
        evidenceId: "ev-3",
        evidenceShortId: "EVD-0003",
      }),
    ).toBeNull();
  });

  it("returns the persisted canonical quorum value on idempotent replay", () => {
    const payload = {
      evidenceId: "ev-4",
      evidenceShortId: "EVD-0004",
      validationRequiredApprovals: 2,
    };
    const result = getEvidenceIdempotencyResult(payload);
    expect(result).toEqual({
      id: "ev-4",
      shortId: "EVD-0004",
      validationRequiredApprovals: 2,
    });
  });

  it("rejects unrelated idempotency payloads instead of guessing oldest evidence", () => {
    expect(getEvidenceIdempotencyResult({ submittedByDiscordId: "user-1" })).toBeNull();
  });

  it("requires real discord channel ids before ticket channel persistence", () => {
    expect(shouldPersistTicketChannelId("123456789012345678")).toBe(true);
    expect(shouldPersistTicketChannelId("pending:TKT-0001")).toBe(false);
    expect(shouldPersistTicketChannelId("")).toBe(false);
  });

  it("keeps Drizzle aligned with migration 007 evidence and review fields", () => {
    expect(validateMigration007SchemaShape({
      evidenceColumns: Object.keys(evidence),
      reviewColumns: Object.keys(evidenceReviews),
      capabilities: capabilityEnum.enumValues,
    })).toEqual([]);
  });

  it("keeps metric_config aligned with migration 001 column types and uniqueness", () => {
    expect(metricConfig.enabled.columnType).toBe("PgBoolean");
    expect(metricConfig.enabled.default).toBe(true);
    expect(hasUniqueIndex(metricConfig, ["guild_id", "category", "version"])).toBe(true);
  });

  it("keeps evidence_reviews aligned with migration 001 reviewer uniqueness", () => {
    expect(hasUniqueIndex(evidenceReviews, ["evidence_id", "reviewer_discord_id"])).toBe(true);
  });

  it("keeps migration 001 uniqueness constraints represented in Drizzle", () => {
    expect(hasUniqueIndex(roleMappings, ["guild_id", "capability", "discord_role_id"])).toBe(true);
    expect(hasUniqueIndex(ticketParticipants, ["ticket_id", "discord_id"])).toBe(true);
    expect(hasUniqueIndex(scoreReversals, ["score_event_id"])).toBe(true);
  });

  it("exports migration 001 doctrine and clearance tables", () => {
    expectColumns(doctrineChallenges, ["ticketId", "submittedByDiscordId", "proposedRevision"]);
    expectColumns(clearanceRequests, ["ticketId", "requesterDiscordId", "requestedClearance"]);
  });

  it("exports migration 002 retention and artifact tables", () => {
    expectColumns(retentionPolicies, ["guildId", "class", "retainDays", "enabled"]);
    expectColumns(ticketTranscripts, ["ticketId", "storageUrl", "retentionClass"]);
    expectColumns(evidenceAttachmentCopies, ["evidenceLinkId", "sourceUrl", "storageUrl"]);
    expect(hasUniqueIndex(retentionPolicies, ["guild_id", "class"])).toBe(true);
  });

  it("keeps operational uniqueness constraints represented in Drizzle", () => {
    expect(hasUniqueIndex(rateLimitBuckets, ["guild_id", "actor_discord_id", "action", "window_start"])).toBe(true);
    expect(hasUniqueIndex(botHealthChecks, ["guild_id", "check_id"])).toBe(true);
  });

  it("exports migration 008 controls session storage for serverless deployments", () => {
    expectColumns(controlsSessions, ["id", "user", "capabilities", "accessToken", "expiresAt"]);
  });

  it("keeps workflow and contract uniqueness constraints represented in Drizzle", () => {
    expect(hasUniqueIndex(workflowInstances, ["ticket_id"])).toBe(true);
    expect(hasUniqueIndex(contractDetails, ["ticket_id"])).toBe(true);
  });

  it("exports migration 005 score correction and contract detail tables", () => {
    expectColumns(scoreCorrections, ["scoreEventId", "reversalId", "correctionType"]);
    expectColumns(contractDetails, ["ticketId", "objective", "diplomaticSensitivity"]);
  });

  it("exports migration 007 group credit, witnesses, and appeals tables", () => {
    expectColumns(evidenceSubjects, ["evidenceId", "subjectDiscordId", "pointMultiplier"]);
    expectColumns(evidenceWitnesses, ["evidenceId", "witnessType", "externalReference"]);
    expectColumns(evidenceAppeals, ["evidenceId", "requestedBy", "requestedOutcome"]);
    expect(hasUniqueIndex(evidenceSubjects, ["evidence_id", "subject_discord_id"])).toBe(true);
  });
});
