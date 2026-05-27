import { beforeEach, describe, expect, it, vi } from "vitest";

interface EvidenceRow {
  id: string;
  shortId: string | null;
  status: string;
  metricCategory: string;
  validationRequiredApprovals: number;
  createdAt: Date;
  validatedAt: Date | null;
  submittedByDiscordId: string;
  subjectDiscordId: string | null;
  guildId: string;
}

interface ReviewRow {
  evidenceId: string;
  reviewerDiscordId: string;
  decision: "approve" | "object" | "needs_more_evidence";
  conflictDisclosed: boolean;
}

const state = vi.hoisted(() => ({
  evidenceRows: [] as EvidenceRow[],
  reviewRows: [] as ReviewRow[],
  capturedFilters: [] as Array<Record<string, unknown>>,
}));

vi.mock("../client", () => ({
  db: {
    select: (_columns?: unknown) => ({
      from: (table: unknown) => ({
        where: (predicate: { __filter: Record<string, unknown>; __table: string } | undefined) => {
          state.capturedFilters.push(predicate?.__filter ?? {});
          const tableName = predicate?.__table ?? guessTableName(table);
          const filter = predicate?.__filter ?? {};
          return {
            limit: (_n: number) => Promise.resolve(applyFilter(tableName, filter)),
            // For evidence_reviews we don't call .limit, so the awaited where()
            // result needs to be thenable too.
            then: (resolve: (rows: unknown[]) => void) => resolve(applyFilter(tableName, filter)),
          };
        },
      }),
    }),
  },
}));

vi.mock("../query", () => ({
  and: (...predicates: Array<{ __filter: Record<string, unknown>; __table: string }>) => {
    const filter: Record<string, unknown> = {};
    for (const predicate of predicates) Object.assign(filter, predicate.__filter);
    return {
      __filter: filter,
      __table: predicates.find((p) => p.__table)?.__table,
    };
  },
  eq: (column: { __table: string; __name: string }, value: unknown) => ({
    __filter: { [column.__name]: value },
    __table: column.__table,
  }),
}));

vi.mock("../../schema/drizzle-schema", () => ({
  evidence: {
    __table: "evidence",
    id:                          { __table: "evidence", __name: "id" },
    shortId:                     { __table: "evidence", __name: "shortId" },
    status:                      { __table: "evidence", __name: "status" },
    metricCategory:              { __table: "evidence", __name: "metricCategory" },
    validationRequiredApprovals: { __table: "evidence", __name: "validationRequiredApprovals" },
    createdAt:                   { __table: "evidence", __name: "createdAt" },
    validatedAt:                 { __table: "evidence", __name: "validatedAt" },
    submittedByDiscordId:        { __table: "evidence", __name: "submittedByDiscordId" },
    subjectDiscordId:            { __table: "evidence", __name: "subjectDiscordId" },
    guildId:                     { __table: "evidence", __name: "guildId" },
  },
  evidenceReviews: {
    __table: "evidence_reviews",
    evidenceId:        { __table: "evidence_reviews", __name: "evidenceId" },
    reviewerDiscordId: { __table: "evidence_reviews", __name: "reviewerDiscordId" },
    decision:          { __table: "evidence_reviews", __name: "decision" },
    conflictDisclosed: { __table: "evidence_reviews", __name: "conflictDisclosed" },
  },
}));

function guessTableName(_table: unknown): string {
  return "";
}

function applyFilter(tableName: string, filter: Record<string, unknown>): unknown[] {
  if (tableName === "evidence") {
    return state.evidenceRows.filter((row) =>
      Object.entries(filter).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value),
    );
  }
  if (tableName === "evidence_reviews") {
    return state.reviewRows.filter((row) =>
      Object.entries(filter).every(([key, value]) => (row as unknown as Record<string, unknown>)[key] === value),
    );
  }
  return [];
}

import { getEvidenceStatusForParticipant } from "../evidence-status";

const GUILD = "guild-1";
const SUBMITTER = "submitter-1";
const SUBJECT = "subject-1";
const STRANGER = "stranger-1";
const UUID = "11111111-2222-3333-4444-555555555555";
const SHORT_ID = "EVD-0023";

function seedEvidence(overrides: Partial<EvidenceRow> = {}): EvidenceRow {
  const row: EvidenceRow = {
    id: UUID,
    shortId: SHORT_ID,
    status: "under_review",
    metricCategory: "intelligence_acquisitions",
    validationRequiredApprovals: 2,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    validatedAt: null,
    submittedByDiscordId: SUBMITTER,
    subjectDiscordId: SUBJECT,
    guildId: GUILD,
    ...overrides,
  };
  state.evidenceRows.push(row);
  return row;
}

describe("getEvidenceStatusForParticipant", () => {
  beforeEach(() => {
    state.evidenceRows = [];
    state.reviewRows = [];
    state.capturedFilters = [];
  });

  it("submitter reads status by short ID", async () => {
    seedEvidence();
    const result = await getEvidenceStatusForParticipant({
      guildId: GUILD,
      evidenceIdOrShortId: SHORT_ID,
      requestingDiscordId: SUBMITTER,
    });
    expect(result).toMatchObject({ id: UUID, shortId: SHORT_ID, status: "under_review" });
  });

  it("subject reads status by UUID", async () => {
    seedEvidence();
    const result = await getEvidenceStatusForParticipant({
      guildId: GUILD,
      evidenceIdOrShortId: UUID,
      requestingDiscordId: SUBJECT,
    });
    expect(result?.id).toBe(UUID);
  });

  it("unrelated user receives null", async () => {
    seedEvidence();
    const result = await getEvidenceStatusForParticipant({
      guildId: GUILD,
      evidenceIdOrShortId: SHORT_ID,
      requestingDiscordId: STRANGER,
    });
    expect(result).toBeNull();
  });

  it("wrong guild receives null", async () => {
    seedEvidence();
    const result = await getEvidenceStatusForParticipant({
      guildId: "other-guild",
      evidenceIdOrShortId: SHORT_ID,
      requestingDiscordId: SUBMITTER,
    });
    expect(result).toBeNull();
  });

  it("malformed UUID-shaped input does not throw and returns null", async () => {
    seedEvidence();
    const malformed = ["", "   ", "EVD-", "EVD-not-a-number", "not-a-uuid", "11111111-2222-3333-4444-zzzzzzzzzzzz", "EVD-1; DROP TABLE evidence; --"];
    for (const value of malformed) {
      const result = await getEvidenceStatusForParticipant({
        guildId: GUILD,
        evidenceIdOrShortId: value,
        requestingDiscordId: SUBMITTER,
      });
      expect(result).toBeNull();
    }
  });

  it("EVD-shaped input never reaches a UUID predicate", async () => {
    seedEvidence();
    await getEvidenceStatusForParticipant({
      guildId: GUILD,
      evidenceIdOrShortId: SHORT_ID,
      requestingDiscordId: SUBMITTER,
    });
    const evidenceFilters = state.capturedFilters.filter((f) => "guildId" in f);
    expect(evidenceFilters.length).toBeGreaterThan(0);
    for (const filter of evidenceFilters) {
      expect(filter.id).toBeUndefined();
      expect(filter.shortId).toBe(SHORT_ID);
    }
  });

  it("eligible approval count excludes non-approve, conflicted, submitter and subject approvals", async () => {
    seedEvidence();
    state.reviewRows = [
      { evidenceId: UUID, reviewerDiscordId: "reviewer-a", decision: "approve",             conflictDisclosed: false }, // counts
      { evidenceId: UUID, reviewerDiscordId: "reviewer-b", decision: "approve",             conflictDisclosed: false }, // counts
      { evidenceId: UUID, reviewerDiscordId: "reviewer-c", decision: "approve",             conflictDisclosed: true  }, // conflict — excluded
      { evidenceId: UUID, reviewerDiscordId: "reviewer-d", decision: "object",              conflictDisclosed: false }, // wrong decision
      { evidenceId: UUID, reviewerDiscordId: "reviewer-e", decision: "needs_more_evidence", conflictDisclosed: false }, // wrong decision
      { evidenceId: UUID, reviewerDiscordId: SUBMITTER,    decision: "approve",             conflictDisclosed: false }, // submitter — excluded
      { evidenceId: UUID, reviewerDiscordId: SUBJECT,      decision: "approve",             conflictDisclosed: false }, // subject — excluded
    ];
    const result = await getEvidenceStatusForParticipant({
      guildId: GUILD,
      evidenceIdOrShortId: SHORT_ID,
      requestingDiscordId: SUBMITTER,
    });
    expect(result?.eligibleApprovals).toBe(2);
  });

  it("returns null when no subject exists and stranger requests, regardless of subjectDiscordId fallback", async () => {
    seedEvidence({ subjectDiscordId: null });
    const stranger = await getEvidenceStatusForParticipant({
      guildId: GUILD,
      evidenceIdOrShortId: SHORT_ID,
      requestingDiscordId: STRANGER,
    });
    expect(stranger).toBeNull();
    const submitter = await getEvidenceStatusForParticipant({
      guildId: GUILD,
      evidenceIdOrShortId: SHORT_ID,
      requestingDiscordId: SUBMITTER,
    });
    expect(submitter?.id).toBe(UUID);
  });

  it("result shape excludes description, links, reviewer identity, rationale, conflict, audit fields", async () => {
    seedEvidence();
    const result = await getEvidenceStatusForParticipant({
      guildId: GUILD,
      evidenceIdOrShortId: SHORT_ID,
      requestingDiscordId: SUBMITTER,
    });
    expect(result).not.toBeNull();
    const allowedKeys = new Set([
      "id", "shortId", "status", "metricCategory",
      "validationRequiredApprovals", "eligibleApprovals",
      "createdAt", "validatedAt",
    ]);
    const actualKeys = Object.keys(result as unknown as Record<string, unknown>);
    expect(actualKeys.sort()).toEqual(Array.from(allowedKeys).sort());
    const json = JSON.stringify(result);
    expect(json).not.toContain("description");
    expect(json).not.toContain("rationale");
    expect(json).not.toContain("conflict");
    expect(json).not.toContain("reviewer");
    expect(json).not.toContain("link");
    expect(json).not.toContain("audit");
    expect(json).not.toContain("submittedByDiscordId");
    expect(json).not.toContain("subjectDiscordId");
  });
});
