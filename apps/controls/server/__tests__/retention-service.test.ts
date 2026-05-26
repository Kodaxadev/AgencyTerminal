import { describe, expect, it } from "vitest";
import {
  PROTECTED_RETENTION_CLASSES,
  RETENTION_CLASSES,
  buildRetentionDryRun,
  buildRetentionRunReport,
  normalizeRetentionPolicyInput,
} from "../retention-service";

describe("controls retention service", () => {
  it("lists every configured retention class", () => {
    expect(RETENTION_CLASSES).toEqual([
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
  });

  it("marks score and audit history as protected from destructive runs", () => {
    expect(PROTECTED_RETENTION_CLASSES).toEqual(expect.arrayContaining([
      "audit_log",
      "score_event",
      "score_reversal",
    ]));
  });

  it("rejects negative retain days", () => {
    expect(() => normalizeRetentionPolicyInput({
      class: "ticket_transcript",
      retainDays: -1,
      action: "archive",
      sensitivity: "officer_only",
      enabled: true,
    })).toThrow("retainDays must be zero or greater");
  });

  it("requires a matching dry-run token before a run report can be created", () => {
    const dryRun = buildRetentionDryRun([
      { class: "ticket_transcript", action: "archive", eligibleCount: 2, protected: false },
    ], new Date("2026-05-26T15:00:00.000Z"));

    expect(() => buildRetentionRunReport({
      dryRun,
      dryRunToken: "wrong-token",
      confirmation: "RETENTION",
      ranAt: new Date("2026-05-26T15:01:00.000Z"),
    })).toThrow("Run requires the latest dry-run token");
  });
});
