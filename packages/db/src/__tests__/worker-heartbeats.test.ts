import { beforeEach, describe, expect, it, vi } from "vitest";

const onConflictDoUpdate = vi.hoisted(() => vi.fn());
const values = vi.hoisted(() => vi.fn(() => ({ onConflictDoUpdate })));
const insert = vi.hoisted(() => vi.fn(() => ({ values })));

vi.mock("../client", () => ({
  db: { insert },
}));

describe("recordWorkerHeartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    onConflictDoUpdate.mockResolvedValue(undefined);
  });

  it("upserts worker heartbeat rows with guild metadata", async () => {
    const { workerHeartbeats } = await import("../../schema/drizzle-schema");
    const { recordWorkerHeartbeat } = await import("../worker-heartbeats");
    const now = new Date("2026-05-25T18:00:00.000Z");

    await recordWorkerHeartbeat({
      workerName: "outbox_processor",
      guildId: "guild-1",
      metadata: { processed: 2, errors: 1 },
      now,
    });

    expect(insert).toHaveBeenCalledWith(workerHeartbeats);
    expect(values).toHaveBeenCalledWith({
      workerName: "outbox_processor",
      guildId: "guild-1",
      lastSeenAt: now,
      metadata: { processed: 2, errors: 1 },
    });
    expect(onConflictDoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      target: workerHeartbeats.workerName,
    }));
  });
});
