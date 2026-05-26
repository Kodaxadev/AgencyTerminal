import type { ControlsSession } from "./session";

export const SESSION_AUTH_REVALIDATE_MS = 5 * 60 * 1000;

export function shouldRefreshSessionAuthorization(
  session: ControlsSession,
  now: number,
  maxAgeMs = SESSION_AUTH_REVALIDATE_MS,
): boolean {
  return session.capabilities.length === 0 || now - session.validatedAt >= maxAgeMs;
}
