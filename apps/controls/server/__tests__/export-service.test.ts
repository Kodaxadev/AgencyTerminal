import { describe, expect, it } from "vitest";
import {
  buildExportPayload,
  listAuthorizedExportDescriptors,
  listExportDescriptors,
  requireExportCapability,
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
      sensitivity: "director_only",
      recordCount: 1,
      rows: [{ id: "ticket-1" }],
    });
  });

  it("hides export types the user is not authorized to run", () => {
    const auditOnly = listAuthorizedExportDescriptors(["can_view_audit"]).map((descriptor) => descriptor.type);
    expect(auditOnly).toEqual(["ledger", "agents", "audit"]);

    const ticketsOnly = listAuthorizedExportDescriptors(["can_view_all_tickets"]).map((descriptor) => descriptor.type);
    expect(ticketsOnly).toEqual(["tickets"]);

    const validator = listAuthorizedExportDescriptors(["can_validate_evidence"]).map((descriptor) => descriptor.type);
    expect(validator).toEqual(["ledger"]);

    const noAccess = listAuthorizedExportDescriptors(["can_manage_intel"]).map((descriptor) => descriptor.type);
    expect(noAccess).toEqual([]);

    const configAdmin = listAuthorizedExportDescriptors(["can_manage_config"]).map((descriptor) => descriptor.type);
    expect(configAdmin).toEqual(["ledger", "agents", "audit", "tickets", "retention"]);
  });

  it("blocks an actor without the per-type capability from invoking that export", () => {
    expect(() => requireExportCapability("audit", ["can_view_all_tickets"])).toThrow("Missing required controls capability");
    expect(() => requireExportCapability("tickets", ["can_view_audit"])).toThrow("Missing required controls capability");
    expect(() => requireExportCapability("retention", ["can_view_audit"])).toThrow("Missing required controls capability");
    expect(() => requireExportCapability("audit", ["can_view_audit"])).not.toThrow();
    expect(() => requireExportCapability("tickets", ["can_view_all_tickets"])).not.toThrow();
    expect(() => requireExportCapability("retention", ["can_manage_config"])).not.toThrow();
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
