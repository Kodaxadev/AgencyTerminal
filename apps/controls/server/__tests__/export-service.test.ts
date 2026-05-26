import { describe, expect, it } from "vitest";
import {
  buildExportPayload,
  listExportDescriptors,
  requireExportConfirmation,
} from "../export-service";

describe("controls export service", () => {
  it("lists the supported export types", () => {
    expect(listExportDescriptors().map((descriptor) => descriptor.type)).toEqual([
      "ledger",
      "agents",
      "audit",
      "tickets",
      "retention",
    ]);
  });

  it("requires confirmation for audit and full ledger exports", () => {
    expect(() => requireExportConfirmation("audit", undefined)).toThrow("Type EXPORT to continue");
    expect(() => requireExportConfirmation("ledger", "NO")).toThrow("Type EXPORT to continue");
    expect(() => requireExportConfirmation("audit", "EXPORT")).not.toThrow();
  });

  it("builds export metadata around JSON rows", () => {
    const payload = buildExportPayload("tickets", "guild-1", [{ id: "ticket-1" }], new Date("2026-05-26T15:30:00.000Z"));

    expect(payload).toMatchObject({
      type: "tickets",
      guildId: "guild-1",
      generatedAt: "2026-05-26T15:30:00.000Z",
      sensitivity: "officer_only",
      recordCount: 1,
      rows: [{ id: "ticket-1" }],
    });
  });

  it("redacts high-risk row fields from export payloads", () => {
    const payload = buildExportPayload("ledger", "guild-1", [{
      kind: "evidence",
      id: "evidence-1",
      title: "Visible title",
      description: "sensitive report body",
      payload: { source: "confidential" },
      walletAddress: "0xsecret",
      createdAt: "2026-05-26T15:30:00.000Z",
    }], new Date("2026-05-26T15:30:00.000Z"));

    expect(payload.rows[0]).toEqual({
      kind: "evidence",
      id: "evidence-1",
      title: "Visible title",
      description: "[REDACTED]",
      payload: "[REDACTED]",
      walletAddress: "[REDACTED]",
      createdAt: "2026-05-26T15:30:00.000Z",
    });
  });
});
