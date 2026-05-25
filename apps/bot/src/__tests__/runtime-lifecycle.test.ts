import { beforeEach, describe, expect, it, vi } from "vitest";
import { installRuntimeLifecycle } from "../runtime-lifecycle";

describe("runtime lifecycle shutdown", () => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const processLike = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return processLike;
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
      return processLike;
    }),
    exitCode: undefined as number | undefined,
  };

  beforeEach(() => {
    handlers.clear();
    processLike.on.mockClear();
    processLike.off.mockClear();
    processLike.exitCode = undefined;
  });

  it("SIGTERM stops loop, destroys Discord client, and closes DB pool once", async () => {
    const loop = { stopAndDrain: vi.fn(async () => {}) };
    const client = { destroy: vi.fn() };
    const closeDbPool = vi.fn(async () => {});

    const lifecycle = installRuntimeLifecycle({
      loop,
      client,
      closeDbPool,
      processLike,
      shutdownTimeoutMs: 1000,
    });

    handlers.get("SIGTERM")?.();
    handlers.get("SIGTERM")?.();
    await lifecycle.shutdown();

    expect(loop.stopAndDrain).toHaveBeenCalledTimes(1);
    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(closeDbPool).toHaveBeenCalledTimes(1);
    expect(processLike.exitCode).toBe(0);
  });

  it("SIGTERM before ready closes Discord and DB resources without outbox work", async () => {
    const client = { destroy: vi.fn() };
    const closeDbPool = vi.fn(async () => {});

    const lifecycle = installRuntimeLifecycle({
      client,
      closeDbPool,
      processLike,
      shutdownTimeoutMs: 1000,
    });

    handlers.get("SIGTERM")?.();
    await lifecycle.shutdown();

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(closeDbPool).toHaveBeenCalledTimes(1);
    expect(lifecycle.isShuttingDown()).toBe(true);
    expect(processLike.exitCode).toBe(0);
  });

  it("SIGINT before ready follows the same no-loop shutdown path", async () => {
    const client = { destroy: vi.fn() };
    const closeDbPool = vi.fn(async () => {});

    const lifecycle = installRuntimeLifecycle({
      client,
      closeDbPool,
      processLike,
      shutdownTimeoutMs: 1000,
    });

    handlers.get("SIGINT")?.();
    await lifecycle.shutdown();

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(closeDbPool).toHaveBeenCalledTimes(1);
    expect(processLike.exitCode).toBe(0);
  });

  it("after-ready shutdown stops and drains the attached outbox loop once", async () => {
    const loop = { stopAndDrain: vi.fn(async () => {}) };
    const client = { destroy: vi.fn() };
    const closeDbPool = vi.fn(async () => {});

    const lifecycle = installRuntimeLifecycle({
      client,
      closeDbPool,
      processLike,
      shutdownTimeoutMs: 1000,
    });
    lifecycle.attachLoop(loop);

    handlers.get("SIGTERM")?.();
    handlers.get("SIGTERM")?.();
    await lifecycle.shutdown();

    expect(loop.stopAndDrain).toHaveBeenCalledTimes(1);
    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(closeDbPool).toHaveBeenCalledTimes(1);
  });

  it("SIGINT uses the same shutdown path", async () => {
    const loop = { stopAndDrain: vi.fn(async () => {}) };
    const client = { destroy: vi.fn() };
    const closeDbPool = vi.fn(async () => {});

    const lifecycle = installRuntimeLifecycle({
      loop,
      client,
      closeDbPool,
      processLike,
      shutdownTimeoutMs: 1000,
    });

    handlers.get("SIGINT")?.();
    await lifecycle.shutdown();

    expect(loop.stopAndDrain).toHaveBeenCalledTimes(1);
    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(closeDbPool).toHaveBeenCalledTimes(1);
  });

  it("continues cleanup when one step fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const loop = { stopAndDrain: vi.fn(() => Promise.reject(new Error("loop failed"))) };
    const client = { destroy: vi.fn(() => { throw new Error("discord failed"); }) };
    const closeDbPool = vi.fn(async () => {});

    const lifecycle = installRuntimeLifecycle({
      loop,
      client,
      closeDbPool,
      processLike,
      shutdownTimeoutMs: 1000,
    });

    handlers.get("SIGTERM")?.();
    await lifecycle.shutdown();

    expect(loop.stopAndDrain).toHaveBeenCalledTimes(1);
    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(closeDbPool).toHaveBeenCalledTimes(1);
    expect(processLike.exitCode).toBe(1);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("runtime_shutdown_step_failed"));
    consoleError.mockRestore();
  });
});
