import type { IncomingMessage } from "node:http";
import { HttpError } from "./http-utils";

const DEFAULT_MUTATION_LIMIT_PER_MINUTE = 20;
const MUTATION_WINDOW_SECONDS = 60;
const UNSAFE_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export interface MutationRateLimit {
  limitCount: number;
  windowSeconds: number;
}

export function requireTrustedMutationOrigin(
  req: IncomingMessage,
  env: NodeJS.ProcessEnv,
): void {
  if (!isUnsafeMethod(req.method)) return;

  const origin = headerValue(req.headers.origin);
  if (!origin) {
    if (env.NODE_ENV === "production") throw new HttpError(403, "Missing Origin");
    return;
  }

  if (parseOrigin(origin) !== resolveTargetOrigin(req, env)) {
    throw new HttpError(403, "Origin is not allowed");
  }
}

export function getMutationRateLimit(env: NodeJS.ProcessEnv): MutationRateLimit {
  const configured = Number(env.CONTROLS_MUTATION_LIMIT_PER_MINUTE);
  return {
    limitCount: Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_MUTATION_LIMIT_PER_MINUTE,
    windowSeconds: MUTATION_WINDOW_SECONDS,
  };
}

export function buildMutationAction(method: string | undefined, url: URL): string {
  return `${(method ?? "GET").toUpperCase()} ${url.pathname}`;
}

export function isUnsafeMethod(method: string | undefined): boolean {
  return UNSAFE_METHODS.has((method ?? "GET").toUpperCase());
}

function resolveTargetOrigin(req: IncomingMessage, env: NodeJS.ProcessEnv): string | null {
  const publicBaseUrl = env.CONTROLS_PUBLIC_BASE_URL;
  if (publicBaseUrl) return parseOrigin(publicBaseUrl);

  const forwardedHost = headerValue(req.headers["x-forwarded-host"]);
  const host = forwardedHost ?? headerValue(req.headers.host);
  if (!host) return null;
  const forwardedProto = headerValue(req.headers["x-forwarded-proto"]);
  const protocol = forwardedProto ?? (env.NODE_ENV === "production" ? "https" : "http");
  return parseOrigin(`${protocol}://${host}`);
}

function parseOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
