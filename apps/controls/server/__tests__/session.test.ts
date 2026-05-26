import { describe, expect, it } from "vitest";
import { buildDiscordAuthorizeUrl } from "../auth/oauth";
import {
  MemorySessionStore,
  createSessionCookie,
  readSessionIdFromCookie,
  signSessionId,
} from "../auth/session";

const NOW = new Date("2026-05-25T20:00:00.000Z");

describe("controls sessions", () => {
  it("creates signed httpOnly cookies and resolves known sessions", () => {
    const store = new MemorySessionStore(() => NOW);
    const session = store.create({
      user: { id: "leader-1", username: "leader" },
      guildId: "guild-1",
      discordRoleIds: ["role-1"],
      capabilities: ["can_manage_config"],
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenExpiresAt: NOW.getTime() + 60_000,
      validatedAt: NOW.getTime(),
      expiresAt: NOW.getTime() + 60_000,
    });

    const cookie = createSessionCookie({
      sessionId: session.id,
      secret: "test-secret",
      secure: true,
      maxAgeSeconds: 300,
    });

    const parsedId = readSessionIdFromCookie(cookie, "test-secret");

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(store.get(parsedId ?? "")?.user.id).toBe("leader-1");
  });

  it("rejects tampered session cookies", () => {
    const token = signSessionId("session-1", "test-secret");
    const tampered = token.replace("session-1", "session-2");

    expect(readSessionIdFromCookie(`controls_session=${tampered}`, "test-secret")).toBeNull();
  });

  it("rejects expired and unknown sessions", () => {
    const store = new MemorySessionStore(() => NOW);
    const session = store.create({
      user: { id: "leader-1", username: "leader" },
      guildId: "guild-1",
      discordRoleIds: [],
      capabilities: [],
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenExpiresAt: NOW.getTime() + 60_000,
      validatedAt: NOW.getTime(),
      expiresAt: NOW.getTime() - 1,
    });

    expect(store.get(session.id)).toBeNull();
    expect(store.get("missing-session")).toBeNull();
  });
});

describe("Discord OAuth URL", () => {
  it("uses identity, guild, and guild member scopes", () => {
    const url = buildDiscordAuthorizeUrl({
      clientId: "client-1",
      redirectUri: "https://controls.example.com/api/auth/discord/callback",
      state: "state-1",
    });

    expect(url.origin).toBe("https://discord.com");
    expect(url.searchParams.get("scope")).toBe("identify guilds guilds.members.read");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("state-1");
  });
});
