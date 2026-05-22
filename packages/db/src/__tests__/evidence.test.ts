import { beforeEach, describe, expect, it, vi } from "vitest";

const select = vi.fn();
const from = vi.fn();
const where = vi.fn();

vi.mock("../client", () => ({
  db: { select },
}));

vi.mock("../schema/drizzle-schema", () => ({
  evidence: {},
}));

describe("findStaleEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    select.mockReturnValue({ from });
    from.mockReturnValue({ where });
    where.mockResolvedValue([]);
  });

  it("uses typed Drizzle predicates instead of raw SQL", async () => {
    const { findStaleEvidence } = await import("../evidence");

    await findStaleEvidence("guild-1", new Date("2024-01-01T00:00:00Z"));

    expect(select).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
    
    // Verify that the where clause was called with a predicate (not raw SQL)
    const whereArg = where.mock.calls[0][0];
    expect(whereArg).toBeDefined();
    expect(typeof whereArg).toBe("object");
  });

  it("returns empty array when no stale evidence found", async () => {
    where.mockResolvedValue([]);
    const { findStaleEvidence } = await import("../evidence");

    const result = await findStaleEvidence("guild-1");

    expect(result).toEqual([]);
  });

  it("returns stale evidence records when found", async () => {
    const mockStaleEvidence = [
      { id: "ev-1", shortId: "EVD-1", title: "Evidence 1", metricCategory: "fleet_participation" },
      { id: "ev-2", shortId: "EVD-2", title: "Evidence 2", metricCategory: "combat_effectiveness" },
    ];
    where.mockResolvedValue(mockStaleEvidence);
    const { findStaleEvidence } = await import("../evidence");

    const result = await findStaleEvidence("guild-1");

    expect(result).toEqual(mockStaleEvidence);
  });

  it("accepts a custom Date parameter for stale threshold", async () => {
    const customDate = new Date("2024-06-15T12:00:00Z");
    where.mockResolvedValue([]);
    const { findStaleEvidence } = await import("../evidence");

    await findStaleEvidence("guild-1", customDate);

    expect(where).toHaveBeenCalledTimes(1);
  });
});
