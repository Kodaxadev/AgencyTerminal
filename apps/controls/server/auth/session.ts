import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Capability, ControlsUser } from "../../src/contracts";

export const SESSION_COOKIE_NAME = "controls_session";

export interface ControlsSession {
  id: string;
  user: ControlsUser;
  guildId: string;
  discordRoleIds: string[];
  capabilities: Capability[];
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  validatedAt: number;
  expiresAt: number;
}

export type MaybePromise<T> = T | Promise<T>;

export interface SessionStore {
  create(input: Omit<ControlsSession, "id"> & { id?: string }): MaybePromise<ControlsSession>;
  get(sessionId: string): MaybePromise<ControlsSession | null>;
  update(sessionId: string, patch: Partial<Omit<ControlsSession, "id">>): MaybePromise<ControlsSession | null>;
  delete(sessionId: string): MaybePromise<void>;
}

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, ControlsSession>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  create(input: Omit<ControlsSession, "id"> & { id?: string }): ControlsSession {
    const session = { ...input, id: input.id ?? randomSessionId() };
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): ControlsSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt <= this.now().getTime()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  update(sessionId: string, patch: Partial<Omit<ControlsSession, "id">>): ControlsSession | null {
    const current = this.get(sessionId);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.sessions.set(sessionId, next);
    return next;
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

export function signSessionId(sessionId: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(sessionId).digest("base64url");
  return `${sessionId}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): string | null {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const sessionId = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = signSessionId(sessionId, secret).slice(separator + 1);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;

  return timingSafeEqual(signatureBuffer, expectedBuffer) ? sessionId : null;
}

export function createSessionCookie(input: {
  sessionId: string;
  secret: string;
  secure: boolean;
  maxAgeSeconds: number;
}): string {
  const token = signSessionId(input.sessionId, input.secret);
  const attributes = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${input.maxAgeSeconds}`,
  ];
  if (input.secure) attributes.push("Secure");
  return attributes.join("; ");
}

export function createExpiredSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readSessionIdFromCookie(cookieHeader: string | undefined, secret: string): string | null {
  if (!cookieHeader) return null;
  const cookies = parseCookieHeader(cookieHeader);
  const token = cookies.get(SESSION_COOKIE_NAME);
  return token ? verifySessionToken(token, secret) : null;
}

function parseCookieHeader(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name || valueParts.length === 0) continue;
    cookies.set(name, valueParts.join("="));
  }
  return cookies;
}

function randomSessionId(): string {
  return randomBytes(24).toString("base64url");
}
