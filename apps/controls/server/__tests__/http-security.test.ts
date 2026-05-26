import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { MemorySessionStore, createSessionCookie } from "../auth/session";
import type { ControlsRepository } from "../repository";

const NOW = Date.now();
type HandleApiRequest = typeof import("../http").handleApiRequest;

describe("controls HTTP security guards", () => {
  it("rejects cross-origin mutations before logout handling", async () => {
    const result = await send({
      method: "POST",
      url: "/api/auth/logout",
      origin: "https://attacker.example",
      env: productionEnv(),
    });

    expect(result.statusCode).toBe(403);
    expect(result.body).toContain("Origin is not allowed");
  });

  it("throttles protected mutations before state changes", async () => {
    const createRoleMapping = vi.fn();
    const consumeRateLimit = vi.fn().mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 42,
    });
    const sessions = new MemorySessionStore(() => new Date(NOW));
    const session = sessions.create({
      user: { id: "actor-1", username: "actor" },
      guildId: "guild-1",
      discordRoleIds: [],
      capabilities: ["can_manage_config"],
      accessToken: "access",
      refreshToken: "refresh",
      tokenExpiresAt: NOW + 60_000,
      validatedAt: NOW,
      expiresAt: NOW + 60_000,
    });

    const result = await send({
      method: "POST",
      url: "/api/roles",
      origin: "https://atcc.kodaxa.dev",
      cookie: createSessionCookie({
        sessionId: session.id,
        secret: "test-secret",
        secure: true,
        maxAgeSeconds: 300,
      }),
      body: {
        discordRoleId: "role-1",
        capability: "can_view_audit",
        confirmation: "SAVE",
      },
      env: productionEnv(),
      sessions,
      repository: makeRepository({ consumeRateLimit, createRoleMapping }),
    });

    expect(result.statusCode).toBe(429);
    expect(result.headers.get("retry-after")).toBe("42");
    expect(createRoleMapping).not.toHaveBeenCalled();
  });
});

async function send(input: {
  method: string;
  url: string;
  origin?: string;
  cookie?: string;
  body?: Record<string, unknown>;
  env: NodeJS.ProcessEnv;
  sessions?: MemorySessionStore;
  repository?: ControlsRepository;
}): Promise<{
  statusCode: number;
  headers: Map<string, string>;
  body: string;
}> {
  const { handleApiRequest } = await loadHttp();
  const req = Readable.from(input.body ? [JSON.stringify(input.body)] : []);
  Object.assign(req, {
    method: input.method,
    url: input.url,
    headers: {
      host: "atcc.kodaxa.dev",
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.cookie ? { cookie: input.cookie } : {}),
    },
  });
  const output = makeResponse();

  await handleApiRequest(req as Parameters<typeof handleApiRequest>[0], output.res, {
    env: input.env,
    repository: input.repository ?? makeRepository(),
    sessions: input.sessions ?? new MemorySessionStore(),
    registerCommands: vi.fn(),
  });

  return output.result();
}

async function loadHttp(): Promise<{ handleApiRequest: HandleApiRequest }> {
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/postgres";
  return import("../http");
}

function productionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    CONTROLS_ENABLED: "true",
    CONTROLS_PUBLIC_BASE_URL: "https://atcc.kodaxa.dev",
    CONTROLS_SESSION_SECRET: "test-secret",
    DISCORD_GUILD_ID: "guild-1",
  };
}

function makeRepository(overrides: Partial<ControlsRepository> = {}): ControlsRepository {
  return {
    listRoleCapabilityMappings: vi.fn().mockResolvedValue([]),
    consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
    createRoleMapping: vi.fn(),
    ...overrides,
  } as unknown as ControlsRepository;
}

function makeResponse(): {
  res: Parameters<HandleApiRequest>[1];
  result: () => { statusCode: number; headers: Map<string, string>; body: string };
} {
  const headers = new Map<string, string>();
  let body = "";
  const res = {
    statusCode: 0,
    setHeader: vi.fn((key: string, value: string) => {
      headers.set(key.toLowerCase(), value);
    }),
    end: vi.fn((chunk?: string) => {
      body += chunk ?? "";
    }),
  } as unknown as Parameters<HandleApiRequest>[1];
  return {
    res,
    result: () => ({ statusCode: res.statusCode, headers, body }),
  };
}
