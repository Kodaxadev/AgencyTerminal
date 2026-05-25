import { describe, expect, it, vi } from "vitest";

vi.mock("@agency-terminal/db", () => ({
  closeDbPool: vi.fn(async () => {}),
}));
vi.mock("../commands", () => ({
  registerCommands: vi.fn(async () => {}),
}));
vi.mock("../handlers", () => ({
  handleInteraction: vi.fn(),
}));
vi.mock("../outbox-loop", () => ({
  startOutboxLoop: vi.fn(),
}));
vi.mock("../runtime-lifecycle", () => ({
  installRuntimeLifecycle: vi.fn(),
}));

describe("bootstrap login lifecycle handling", () => {
  it("does not propagate login rejection after shutdown has started", async () => {
    const { loginWithLifecycleShutdownHandling } = await import("../index");
    const client = { login: vi.fn(() => Promise.reject(new Error("login aborted"))) };
    const lifecycle = { isShuttingDown: vi.fn(() => true) };

    await expect(loginWithLifecycleShutdownHandling(client, lifecycle, "token")).resolves.toBeUndefined();
  });

  it("propagates login rejection when shutdown has not started", async () => {
    const { loginWithLifecycleShutdownHandling } = await import("../index");
    const error = new Error("bad token");
    const client = { login: vi.fn(() => Promise.reject(error)) };
    const lifecycle = { isShuttingDown: vi.fn(() => false) };

    await expect(loginWithLifecycleShutdownHandling(client, lifecycle, "token")).rejects.toBe(error);
  });
});
