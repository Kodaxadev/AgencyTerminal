import { describe, expect, it } from "vitest";
import {
  canSeeEvidenceDomain,
  canSeeTicketDomain,
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

  it("scopes broad ticket reads by per-type domain when the caller lacks cross-domain caps", () => {
    expect(canSeeTicketDomain("contract", ["can_manage_enlistment"])).toBe(false);
    expect(canSeeTicketDomain("clearance", ["can_manage_enlistment"])).toBe(false);
    expect(canSeeTicketDomain("intel", ["can_manage_enlistment"])).toBe(false);
    expect(canSeeTicketDomain("enlistment", ["can_manage_enlistment"])).toBe(true);

    expect(canSeeTicketDomain("enlistment", ["can_manage_contracts"])).toBe(false);
    expect(canSeeTicketDomain("clearance", ["can_manage_contracts"])).toBe(false);
    expect(canSeeTicketDomain("contract", ["can_manage_contracts"])).toBe(true);

    expect(canSeeTicketDomain("contract", ["can_manage_clearance"])).toBe(false);
    expect(canSeeTicketDomain("clearance", ["can_manage_clearance"])).toBe(true);

    expect(canSeeTicketDomain("general", ["can_manage_enlistment"])).toBe(false);
    expect(canSeeTicketDomain("general", ["can_manage_contracts"])).toBe(false);
    expect(canSeeTicketDomain("general", ["can_view_all_tickets"])).toBe(true);
  });

  it("admits broad ticket-reader and audit caps as cross-domain for tickets", () => {
    for (const type of ["contract", "clearance", "intel", "enlistment", "general"] as const) {
      expect(canSeeTicketDomain(type, ["can_view_all_tickets"])).toBe(true);
      expect(canSeeTicketDomain(type, ["can_view_audit"])).toBe(true);
      expect(canSeeTicketDomain(type, ["can_manage_config"])).toBe(true);
    }
  });

  it("blocks cross-type director leakage even when the caller has domain access to a neighbor", () => {
    expect(canViewTicketRow("contract", "director_only", ["can_manage_contracts"])).toBe(false);
    expect(canViewTicketRow("contract", "director_only", ["can_manage_contracts", "can_view_sensitive_intel"])).toBe(false);
    expect(canViewTicketRow("contract", "director_only", ["can_manage_contracts", "can_view_sensitive_contracts"])).toBe(true);
    expect(canViewTicketRow("clearance", "director_only", ["can_manage_clearance"])).toBe(false);
    expect(canViewTicketRow("clearance", "director_only", ["can_manage_clearance", "can_manage_config"])).toBe(true);
  });

  it("scopes broad evidence reads by per-category domain when the caller lacks cross-domain caps", () => {
    expect(canSeeEvidenceDomain("intelligence_acquisitions", ["can_manage_contracts"])).toBe(false);
    expect(canSeeEvidenceDomain("contracts_completed", ["can_manage_intel"])).toBe(false);
    expect(canSeeEvidenceDomain("intelligence_acquisitions", ["can_manage_intel"])).toBe(true);
    expect(canSeeEvidenceDomain("contracts_completed", ["can_manage_contracts"])).toBe(true);

    expect(canSeeEvidenceDomain("pvp_kill_value", ["can_manage_intel"])).toBe(false);
    expect(canSeeEvidenceDomain("pvp_kill_value", ["can_validate_evidence"])).toBe(true);
    expect(canSeeEvidenceDomain("pvp_kill_value", ["can_view_audit"])).toBe(true);
  });

  it("rejects broad-evidence rows when the caller lacks any cross-domain or matching-domain cap", () => {
    expect(canViewEvidenceRow("intelligence_acquisitions", "officer_only", ["can_manage_contracts"])).toBe(false);
    expect(canViewEvidenceRow("contracts_completed", "officer_only", ["can_manage_intel"])).toBe(false);
    expect(canViewEvidenceRow("intelligence_acquisitions", "officer_only", ["can_manage_intel"])).toBe(true);
    expect(canViewEvidenceRow("intelligence_acquisitions", "officer_only", ["can_validate_evidence"])).toBe(true);
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
