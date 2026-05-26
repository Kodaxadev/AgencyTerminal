import { describe, expect, it } from "vitest";
import { getStatusTone, visibleNavigation } from "../view-model";

describe("controls view model", () => {
  it("shows only navigation items allowed by capabilities", () => {
    expect(visibleNavigation(["can_validate_evidence"]).map((item) => item.href)).toEqual([
      "/",
      "/evidence",
    ]);
    expect(visibleNavigation(["can_manage_config"]).map((item) => item.href)).toEqual(expect.arrayContaining([
      "/deployment",
      "/retention",
      "/exports",
    ]));
    expect(visibleNavigation(["can_manage_intel"]).map((item) => item.href)).toContain("/evidence/intel");
    expect(visibleNavigation(["can_manage_contracts"]).map((item) => item.href)).toContain("/contracts");
    expect(visibleNavigation(["can_manage_clearance"]).map((item) => item.href)).toContain("/clearance");
  });

  it("maps service status codes to stable visual tones", () => {
    expect(getStatusTone(200)).toBe("ok");
    expect(getStatusTone(206)).toBe("warn");
    expect(getStatusTone(503)).toBe("fail");
  });
});
