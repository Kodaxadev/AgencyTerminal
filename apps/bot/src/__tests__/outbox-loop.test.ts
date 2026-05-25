import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startOutboxLoop } from "../outbox-loop";

describe("outbox loop lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts polling and invokes recovery before outbox work", async () => {
    const order: string[] = [];
    const recoverFn = vi.fn(() => {
      order.push("recover");
      return Promise.resolve();
    });
    const processOutboxFn = vi.fn(() => {
      order.push("process");
      return Promise.resolve({ processed: 0, errors: 0, staleAlerts: 0 });
    });

    const loop = startOutboxLoop({
      client: {} as never,
      guildId: "guild-1",
      intervalMs: 1000,
      processOutboxFn,
      recoverFn,
    });

    await loop.runOnce();

    expect(order).toEqual(["recover", "process"]);
    expect(processOutboxFn).toHaveBeenCalledWith({} as never, "guild-1");
    loop.stop();
  });

  it("stop clears the timer and prevents new scheduled work", async () => {
    const processOutboxFn = vi.fn(() => Promise.resolve({ processed: 0, errors: 0, staleAlerts: 0 }));
    const loop = startOutboxLoop({
      client: {} as never,
      guildId: "guild-1",
      intervalMs: 1000,
      processOutboxFn,
    });

    loop.stop();
    await vi.advanceTimersByTimeAsync(2000);

    expect(processOutboxFn).not.toHaveBeenCalled();
    expect(loop.isStopped()).toBe(true);
  });

  it("does not run overlapping processors on rapid ticks", async () => {
    let release!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      release = resolve;
    });
    const processOutboxFn = vi.fn(async () => {
      await inFlight;
      return { processed: 0, errors: 0, staleAlerts: 0 };
    });
    const loop = startOutboxLoop({
      client: {} as never,
      guildId: "guild-1",
      intervalMs: 1000,
      processOutboxFn,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(processOutboxFn).toHaveBeenCalledTimes(1);
    release();
    await loop.stopAndDrain();
  });

  it("stopAndDrain waits for in-flight work", async () => {
    let release!: () => void;
    let completed = false;
    const inFlight = new Promise<void>((resolve) => {
      release = resolve;
    });
    const processOutboxFn = vi.fn(async () => {
      await inFlight;
      completed = true;
      return { processed: 0, errors: 0, staleAlerts: 0 };
    });
    const loop = startOutboxLoop({
      client: {} as never,
      guildId: "guild-1",
      intervalMs: 1000,
      processOutboxFn,
    });

    const running = loop.runOnce();
    const draining = loop.stopAndDrain();
    await Promise.resolve();

    expect(completed).toBe(false);
    release();
    await running;
    await draining;

    expect(completed).toBe(true);
    expect(loop.isStopped()).toBe(true);
  });

  it("logs processor errors without crashing the loop", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const processOutboxFn = vi.fn(() => Promise.reject(new Error("database unavailable")));
    const loop = startOutboxLoop({
      client: {} as never,
      guildId: "guild-1",
      intervalMs: 1000,
      processOutboxFn,
    });

    await loop.runOnce();

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("outbox_loop_run_failed"));
    loop.stop();
    consoleError.mockRestore();
  });
});
