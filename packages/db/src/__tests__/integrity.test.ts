import { describe, expect, it } from "vitest";
import {
  getEvidenceEventTicketId,
  getEvidenceIdempotencyResult,
  shouldPersistTicketChannelId,
  validateMigration007SchemaShape,
} from "../integrity";
import { evidence, evidenceReviews, capabilityEnum } from "../../schema/drizzle-schema";

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
});
