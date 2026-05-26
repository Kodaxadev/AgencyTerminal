import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { handleExportsRoute } from "../routes/exports";
import type { ProtectedRouteContext } from "../routes/types";
import type { Capability } from "../../src/contracts";

describe("controls export routes", () => {
  it("requires config capability", async () => {
    await expect(handleExportsRoute(makeContext({
      method: "GET",
      pathname: "/api/exports",
      capabilities: [],
    }))).rejects.toThrow("Missing required controls capability");
  });

  it("passes typed confirmation into audit exports", async () => {
    const buildExport = vi.fn().mockResolvedValue({
      type: "audit",
      guildId: "guild-1",
      generatedAt: "2026-05-26T15:00:00.000Z",
      sensitivity: "officer_only",
      recordCount: 0,
      rows: [],
    });
    const repository = makeRepository({ buildExport });

    await handleExportsRoute(makeContext({
      method: "POST",
      pathname: "/api/exports/audit",
      body: { confirmation: "EXPORT" },
      repository,
    }));

    expect(buildExport).toHaveBeenCalledWith("audit", "guild-1", "actor-1", "EXPORT");
  });
});

function makeContext(input: {
  method: string;
  pathname: string;
  body?: Record<string, unknown>;
  capabilities?: Capability[];
  repository?: ReturnType<typeof makeRepository>;
}): ProtectedRouteContext {
  const req = Readable.from(input.body ? [JSON.stringify(input.body)] : []);
  Object.assign(req, { method: input.method });
  return {
    req: req as ProtectedRouteContext["req"],
    res: makeResponse(),
    url: new URL(input.pathname, "http://controls.local"),
    deps: {
      env: {},
      repository: input.repository ?? makeRepository(),
      sessions: {} as ProtectedRouteContext["deps"]["sessions"],
      registerCommands: vi.fn(),
    },
    auth: {
      sessionId: "session-1",
      session: {
        id: "session-1",
        user: { id: "actor-1", username: "actor" },
        guildId: "guild-1",
        discordRoleIds: [],
        capabilities: input.capabilities ?? ["can_manage_config"],
        accessToken: "access",
        refreshToken: "refresh",
        tokenExpiresAt: Date.now() + 1000,
        validatedAt: Date.now(),
        expiresAt: Date.now() + 1000,
      },
    },
    guildId: "guild-1",
  };
}

function makeRepository(overrides: Partial<ProtectedRouteContext["deps"]["repository"]> = {}) {
  return {
    listAvailableExports: vi.fn().mockResolvedValue([]),
    buildExport: vi.fn().mockResolvedValue({
      type: "audit",
      guildId: "guild-1",
      generatedAt: "2026-05-26T15:00:00.000Z",
      sensitivity: "officer_only",
      recordCount: 0,
      rows: [],
    }),
    ...overrides,
  } as unknown as ProtectedRouteContext["deps"]["repository"];
}

function makeResponse(): ProtectedRouteContext["res"] {
  return {
    statusCode: 0,
    setHeader: vi.fn(),
    end: vi.fn(),
  } as unknown as ProtectedRouteContext["res"];
}
