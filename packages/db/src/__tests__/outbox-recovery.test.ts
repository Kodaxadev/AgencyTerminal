import { beforeEach, describe, expect, it, vi } from "vitest";

const returning = vi.hoisted(() => vi.fn());
const where = vi.hoisted(() => vi.fn(() => ({ returning })));
const set = vi.hoisted(() => vi.fn(() => ({ where })));
const update = vi.hoisted(() => vi.fn(() => ({ set })));

vi.mock("../client", () => ({
  db: { update },
}));

describe("recoverAbandonedOutboxClaims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    returning.mockResolvedValue([]);
  });

  it("uses typed Drizzle update predicates so fresh processing rows are not reclaimed prematurely", async () => {
    const { discordOutbox } = await import("../../schema/drizzle-schema");
    const { recoverAbandonedOutboxClaims } = await import("../outbox");
    const now = new Date("2026-05-24T12:00:00.000Z");

    const result = await recoverAbandonedOutboxClaims({ leaseMs: 300_000, now });

    expect(result.recovered).toBe(0);
    expect(result.leaseMs).toBe(300_000);
    expect(update).toHaveBeenCalledWith(discordOutbox);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      lastError: "abandoned_processing_claim_recovered",
      nextAttemptAt: now,
      updatedAt: now,
    }));
    expect(where).toHaveBeenCalledOnce();
  });

  it("returns expired processing rows to retry eligibility without incrementing attempts", async () => {
    returning.mockResolvedValue([{ id: "outbox-1" }, { id: "outbox-2" }]);
    const { recoverAbandonedOutboxClaims } = await import("../outbox");

    const result = await recoverAbandonedOutboxClaims({
      leaseMs: 300_000,
      now: new Date("2026-05-24T12:00:00.000Z"),
    });

    expect(result.recovered).toBe(2);
    const setMock = set as unknown as { mock: { calls: Array<[Record<string, unknown>]> } };
    const setPayload = setMock.mock.calls[0][0];
    expect(setPayload).not.toHaveProperty("attempts");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      lastError: "abandoned_processing_claim_recovered",
    }));
  });

  it("limits recovery to processing rows through the typed where clause", async () => {
    const { recoverAbandonedOutboxClaims } = await import("../outbox");

    await recoverAbandonedOutboxClaims();

    expect(where).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
