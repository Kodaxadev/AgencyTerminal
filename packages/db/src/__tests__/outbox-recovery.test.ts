import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
vi.mock("../client", () => ({
  db: { execute },
}));

function sqlText(value: unknown): string {
  const chunks = (value as { queryChunks?: Array<{ value?: string[] } | string> }).queryChunks ?? [];
  return chunks.map((chunk) => {
    if (typeof chunk === "string") return chunk;
    if ("value" in chunk && Array.isArray(chunk.value)) return chunk.value.join("");
    return "";
  }).join(" ");
}

describe("recoverAbandonedOutboxClaims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("uses a lease cutoff so fresh processing rows are not reclaimed prematurely", async () => {
    execute.mockResolvedValue([]);
    const { recoverAbandonedOutboxClaims } = await import("../outbox");
    const now = new Date("2026-05-24T12:00:00.000Z");

    const result = await recoverAbandonedOutboxClaims({ leaseMs: 300_000, now });

    expect(result.recovered).toBe(0);
    expect(result.leaseMs).toBe(300_000);
    const query = sqlText(execute.mock.calls[0][0]);
    expect(query).toContain("status = 'processing'");
    expect(query).toContain("updated_at <=");
  });

  it("returns expired processing rows to retry eligibility", async () => {
    execute.mockResolvedValue([{ id: "outbox-1" }, { id: "outbox-2" }]);
    const { recoverAbandonedOutboxClaims } = await import("../outbox");

    const result = await recoverAbandonedOutboxClaims({
      leaseMs: 300_000,
      now: new Date("2026-05-24T12:00:00.000Z"),
    });

    expect(result.recovered).toBe(2);
    const query = sqlText(execute.mock.calls[0][0]);
    expect(query).toContain("set status = 'failed'");
    expect(query).toContain("next_attempt_at =");
    expect(query).toContain("last_error =");
  });

  it("limits recovery to processing rows", async () => {
    execute.mockResolvedValue([]);
    const { recoverAbandonedOutboxClaims } = await import("../outbox");

    await recoverAbandonedOutboxClaims();

    const query = sqlText(execute.mock.calls[0][0]);
    expect(query).toContain("where status = 'processing'");
    expect(query).not.toContain("status = 'sent'");
  });
});
