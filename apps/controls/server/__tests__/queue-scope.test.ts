import { describe, expect, it } from "vitest";
import {
  canViewEvidenceRow,
  canViewSensitivity,
  canViewTicketRow,
  getQueueScope,
} from "../queue-scope";

describe("controls queue scope", () => {
  it("requires intel capability for intel evidence", () => {
    expect(() => getQueueScope("/api/evidence/intel", [])).toThrow("can_manage_intel");
    expect(getQueueScope("/api/evidence/intel", ["can_manage_intel"])).toMatchObject({
      kind: "intel_evidence",
    });
  });

  it("requires contract and clearance capabilities for domain ticket queues", () => {
    expect(() => getQueueScope("/api/contracts", ["can_manage_intel"])).toThrow("can_manage_contracts");
    expect(() => getQueueScope("/api/clearance", ["can_manage_contracts"])).toThrow("can_manage_clearance");
  });

  it("keeps director-only records out of handler queues without sensitive-view capability", () => {
    expect(canViewSensitivity("intel_evidence", "director_only", ["can_validate_evidence"])).toBe(false);
    expect(canViewSensitivity("intel_evidence", "director_only", ["can_view_sensitive_intel"])).toBe(true);
    expect(canViewSensitivity("intel_evidence", "officer_only", ["can_validate_evidence"])).toBe(true);
  });

  it("blocks intel-only sensitive viewers from director-only contract or clearance tickets via broad queue", () => {
    const caps = ["can_view_all_tickets", "can_view_sensitive_intel"] as const;
    expect(canViewTicketRow("contract", "director_only", [...caps])).toBe(false);
    expect(canViewTicketRow("clearance", "director_only", [...caps])).toBe(false);
    expect(canViewTicketRow("contract", "officer_only", [...caps])).toBe(true);
  });

  it("blocks contract-only sensitive viewers from director-only intel evidence via broad queue", () => {
    const caps = ["can_validate_evidence", "can_view_sensitive_contracts"] as const;
    expect(canViewEvidenceRow("intelligence_acquisitions", "director_only", [...caps])).toBe(false);
    expect(canViewEvidenceRow("intelligence_acquisitions", "officer_only", [...caps])).toBe(true);
  });

  it("allows matching sensitive viewers to see same-domain director-only rows via broad queue", () => {
    expect(canViewEvidenceRow("intelligence_acquisitions", "director_only", ["can_view_sensitive_intel"])).toBe(true);
    expect(canViewTicketRow("contract", "director_only", ["can_view_sensitive_contracts"])).toBe(true);
  });

  it("only can_manage_config grants director-only access for clearance tickets via broad queue", () => {
    expect(canViewTicketRow("clearance", "director_only", ["can_view_sensitive_intel"])).toBe(false);
    expect(canViewTicketRow("clearance", "director_only", ["can_view_sensitive_contracts"])).toBe(false);
    expect(canViewTicketRow("clearance", "director_only", ["can_manage_config"])).toBe(true);
  });

  it("only can_manage_config grants director-only access for non-intel evidence categories via broad queue", () => {
    expect(canViewEvidenceRow("enlistment", "director_only", ["can_view_sensitive_intel"])).toBe(false);
    expect(canViewEvidenceRow("enlistment", "director_only", ["can_view_sensitive_contracts"])).toBe(false);
    expect(canViewEvidenceRow("enlistment", "director_only", ["can_manage_config"])).toBe(true);
  });

  it("evaluates director-only sensitivity per domain", () => {
    expect(canViewSensitivity("intel_evidence", "director_only", ["can_view_sensitive_contracts"])).toBe(false);
    expect(canViewSensitivity("contract_tickets", "director_only", ["can_view_sensitive_intel"])).toBe(false);
    expect(canViewSensitivity("clearance_tickets", "director_only", ["can_view_sensitive_intel"])).toBe(false);
    expect(canViewSensitivity("clearance_tickets", "director_only", ["can_view_sensitive_contracts"])).toBe(false);
    expect(canViewSensitivity("contract_tickets", "director_only", ["can_view_sensitive_contracts"])).toBe(true);
    expect(canViewSensitivity("intel_evidence", "director_only", ["can_manage_config"])).toBe(true);
    expect(canViewSensitivity("clearance_tickets", "director_only", ["can_manage_config"])).toBe(true);
  });
});
