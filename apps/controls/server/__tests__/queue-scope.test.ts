import { describe, expect, it } from "vitest";
import { canViewSensitivity, getQueueScope } from "../queue-scope";

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
    expect(canViewSensitivity("director_only", ["can_validate_evidence"])).toBe(false);
    expect(canViewSensitivity("director_only", ["can_view_sensitive_intel"])).toBe(true);
    expect(canViewSensitivity("officer_only", ["can_validate_evidence"])).toBe(true);
  });
});
