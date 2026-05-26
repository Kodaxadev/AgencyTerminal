import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.hoisted(() => vi.fn());
const orderBy = vi.hoisted(() => vi.fn(() => ({ limit })));
const where = vi.hoisted(() => vi.fn(() => ({ orderBy })));
const from = vi.hoisted(() => vi.fn(() => ({ where })));
const select = vi.hoisted(() => vi.fn(() => ({ from })));

vi.mock("../client", () => ({
  db: { select },
}));

describe("getLatestMetricConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    limit.mockResolvedValue([]);
  });

  it("returns the newest metric config row for a guild/category", async () => {
    limit.mockResolvedValueOnce([{
      category: "technical_development_output",
      basePoints: 25,
      visibility: "public",
      enabled: true,
      version: 3,
    }]);
    const { getLatestMetricConfig } = await import("../metric-config");

    const result = await getLatestMetricConfig("guild-1", "technical_development_output");

    expect(result).toEqual({
      category: "technical_development_output",
      basePoints: 25,
      visibility: "public",
      enabled: true,
      version: 3,
    });
    expect(orderBy).toHaveBeenCalledOnce();
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("returns null when the guild has not configured the metric", async () => {
    const { getLatestMetricConfig } = await import("../metric-config");

    await expect(getLatestMetricConfig("guild-1", "technical_development_output")).resolves.toBeNull();
  });
});
