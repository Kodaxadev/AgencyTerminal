import { describe, expect, it } from "vitest";
import { getStatusTone, visibleNavigation } from "../view-model";

describe("controls view model", () => {
  it("shows only navigation items allowed by capabilities", () => {
    expect(visibleNavigation(["can_validate_evidence"]).map((item) => item.href)).toEqual([
      "/",
      "/evidence",
    ]);
    expect(visibleNavigation(["can_manage_config"]).map((item) => item.href)).toContain("/deployment");
  });

  it("maps service status codes to stable visual tones", () => {
    expect(getStatusTone(200)).toBe("ok");
    expect(getStatusTone(206)).toBe("warn");
    expect(getStatusTone(503)).toBe("fail");
  });
});
