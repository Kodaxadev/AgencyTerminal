import { describe, expect, it } from "vitest";
import { shouldRefreshSessionAuthorization } from "../auth/session-refresh";
import type { ControlsSession } from "../auth/session";

const NOW = Date.parse("2026-05-25T20:00:00.000Z");

describe("session authorization refresh policy", () => {
  it("uses cached capabilities during the short revalidation window", () => {
    const session = createSession({
      capabilities: ["can_manage_config"],
      validatedAt: NOW - 60_000,
    });

    expect(shouldRefreshSessionAuthorization(session, NOW)).toBe(false);
  });

  it("refreshes empty or stale session capabilities", () => {
    expect(shouldRefreshSessionAuthorization(createSession({ capabilities: [] }), NOW)).toBe(true);
    expect(shouldRefreshSessionAuthorization(createSession({ validatedAt: NOW - 301_000 }), NOW)).toBe(true);
  });
});

function createSession(patch: Partial<ControlsSession> = {}): ControlsSession {
  return {
    id: "session-1",
    user: { id: "user-1", username: "user" },
    guildId: "guild-1",
    discordRoleIds: ["role-1"],
    capabilities: ["can_manage_config"],
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenExpiresAt: NOW + 60_000,
    validatedAt: NOW,
    expiresAt: NOW + 60_000,
    ...patch,
  };
}
