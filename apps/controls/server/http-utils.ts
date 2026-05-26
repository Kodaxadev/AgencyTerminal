import type { IncomingMessage, ServerResponse } from "node:http";
import type { Capability, GuildConfigDto } from "../src/contracts";

export const STATE_COOKIE = "controls_oauth_state";
export const MAX_JSON_BODY_BYTES = 64 * 1024;

export function controlsEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.CONTROLS_ENABLED === "true";
}

export function requireOAuthEnv(env: NodeJS.ProcessEnv): {
  clientId: string;
  clientSecret: string;
  guildId: string;
  redirectUri: string;
} {
  return {
    clientId: requireEnv(env, "DISCORD_CLIENT_ID"),
    clientSecret: requireEnv(env, "DISCORD_CLIENT_SECRET"),
    guildId: requireEnv(env, "DISCORD_GUILD_ID"),
    redirectUri: env.DISCORD_REDIRECT_URI ?? `${env.CONTROLS_PUBLIC_BASE_URL ?? "http://localhost:3002"}/api/auth/discord/callback`,
  };
}

export function requireSessionSecret(env: NodeJS.ProcessEnv): string {
  return requireEnv(env, "CONTROLS_SESSION_SECRET");
}

export function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) throw new HttpError(503, `Missing required env: ${key}`);
  return value;
}

export function parseBootstrapIds(env: NodeJS.ProcessEnv): string[] {
  return (env.CONTROLS_BOOTSTRAP_DISCORD_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
}

export function secureCookie(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production";
}

export function createStateCookie(state: string, secure: boolean): string {
  const parts = [`${STATE_COOKIE}=${state}`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=300"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function createExpiredStateCookie(): string {
  return `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function toConfigInput(
  body: Record<string, unknown>,
  current: GuildConfigDto,
  guildId: string,
): GuildConfigDto {
  return {
    guildId,
    name: optionalString(body.name) ?? current.name,
    adminChannelId: optionalPatchString(body, "adminChannelId", current.adminChannelId),
    auditChannelId: optionalPatchString(body, "auditChannelId", current.auditChannelId),
    opsQueueChannelId: optionalPatchString(body, "opsQueueChannelId", current.opsQueueChannelId),
    archiveChannelId: optionalPatchString(body, "archiveChannelId", current.archiveChannelId),
    doctrineChangesChannelId: optionalPatchString(body, "doctrineChangesChannelId", current.doctrineChangesChannelId),
    staleReviewHours: optionalNumber(body.staleReviewHours) ?? current.staleReviewHours,
  };
}

export async function readJsonObject(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    size += buffer.byteLength;
    if (size > MAX_JSON_BODY_BYTES) throw new HttpError(413, "JSON body too large");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "Expected JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function requireConfirmation(body: Record<string, unknown>, expected: string): void {
  if (body.confirmation !== expected) throw new HttpError(400, `Type ${expected} to continue`);
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new HttpError(400, `Missing field: ${field}`);
  return value.trim();
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new HttpError(400, `Missing field: ${field}`);
  return value;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new HttpError(400, `Missing field: ${field}`);
  return value;
}

export function requireCapability(value: unknown): Capability {
  return requireString(value, "capability") as Capability;
}

export function readCookieValue(cookieHeader: string | undefined, name: string): string | null {
  const cookie = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? cookie.slice(name.length + 1) : null;
}

export function redirect(res: ServerResponse, location: string, cookies: string[] = []): void {
  res.statusCode = 302;
  res.setHeader("location", location);
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  res.end();
}

export function writeJson(res: ServerResponse, status: number, body: unknown, cookies: string[] = []): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  res.end(status === 204 ? "" : JSON.stringify(body));
}

export function errorStatus(error: unknown): number {
  return error instanceof HttpError ? error.status : 500;
}

export function errorMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  return "Internal server error";
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function optionalPatchString(
  body: Record<string, unknown>,
  key: string,
  current: string | undefined,
): string | undefined {
  return Object.prototype.hasOwnProperty.call(body, key) ? optionalString(body[key]) : current;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
