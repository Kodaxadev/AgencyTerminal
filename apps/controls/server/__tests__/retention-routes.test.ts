import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { handleRetentionRoute } from "../routes/retention";
import type { ProtectedRouteContext } from "../routes/types";
import type { Capability } from "../../src/contracts";

describe("controls retention routes", () => {
  it("requires config capability", async () => {
    await expect(handleRetentionRoute(makeContext({
      method: "GET",
      pathname: "/api/retention",
      capabilities: [],
    }))).rejects.toThrow("Missing required controls capability");
  });

  it("requires typed confirmation before saving a policy", async () => {
    const repository = makeRepository();

    await expect(handleRetentionRoute(makeContext({
      method: "PATCH",
      pathname: "/api/retention/ticket_transcript",
      body: { action: "archive", sensitivity: "officer_only", enabled: true },
      repository,
    }))).rejects.toThrow("RETENTION");

    expect(repository.saveRetentionPolicy).not.toHaveBeenCalled();
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

function makeRepository() {
  return {
    listRetentionPolicies: vi.fn(),
    saveRetentionPolicy: vi.fn(),
    dryRunRetention: vi.fn(),
    runRetention: vi.fn(),
  } as unknown as ProtectedRouteContext["deps"]["repository"];
}

function makeResponse(): ProtectedRouteContext["res"] {
  return {
    statusCode: 0,
    setHeader: vi.fn(),
    end: vi.fn(),
  } as unknown as ProtectedRouteContext["res"];
}
