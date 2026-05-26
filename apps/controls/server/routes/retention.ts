import { canAccessPath } from "../auth/access";
import {
  HttpError,
  readJsonObject,
  requireBoolean,
  requireConfirmation,
  requireString,
  writeJson,
} from "../http-utils";
import type { ProtectedRouteContext } from "./types";

const RETENTION_PREFIX = "/api/retention/";

export async function handleRetentionRoute(context: ProtectedRouteContext): Promise<void> {
  if (!canAccessPath("/retention", context.auth.session.capabilities)) {
    throw new HttpError(403, "Missing required controls capability");
  }

  if (context.req.method === "GET" && context.url.pathname === "/api/retention") {
    writeJson(context.res, 200, await context.deps.repository.listRetentionPolicies(context.guildId));
    return;
  }
  if (context.req.method === "PATCH" && context.url.pathname.startsWith(RETENTION_PREFIX)) {
    await handlePolicySave(context);
    return;
  }
  if (context.req.method === "POST" && context.url.pathname === "/api/retention/dry-run") {
    writeJson(context.res, 200, await context.deps.repository.dryRunRetention(context.guildId));
    return;
  }
  if (context.req.method === "POST" && context.url.pathname === "/api/retention/run") {
    await handleRetentionRun(context);
    return;
  }
  writeJson(context.res, 405, { error: "Method not allowed" });
}

async function handlePolicySave(context: ProtectedRouteContext): Promise<void> {
  const body = await readJsonObject(context.req);
  requireConfirmation(body, "RETENTION");
  const policy = await context.deps.repository.saveRetentionPolicy({
    guildId: context.guildId,
    class: decodeURIComponent(context.url.pathname.slice(RETENTION_PREFIX.length)),
    retainDays: optionalNullableNumber(body.retainDays),
    action: requireString(body.action, "action"),
    sensitivity: requireString(body.sensitivity, "sensitivity"),
    enabled: requireBoolean(body.enabled, "enabled"),
  }, context.auth.session.user.id);
  writeJson(context.res, 200, policy);
}

async function handleRetentionRun(context: ProtectedRouteContext): Promise<void> {
  const body = await readJsonObject(context.req);
  requireConfirmation(body, "RETENTION");
  const report = await context.deps.repository.runRetention(
    context.guildId,
    requireString(body.dryRunToken ?? body.token, "dryRunToken"),
    context.auth.session.user.id,
    "RETENTION",
  );
  writeJson(context.res, 200, report);
}

function optionalNullableNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new HttpError(400, "Invalid retainDays");
  return value;
}
