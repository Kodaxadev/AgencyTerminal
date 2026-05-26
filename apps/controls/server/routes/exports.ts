import { canAccessPath } from "../auth/access";
import { HttpError, readJsonObject, writeJson } from "../http-utils";
import type { ProtectedRouteContext } from "./types";

const EXPORT_PREFIX = "/api/exports/";

export async function handleExportsRoute(context: ProtectedRouteContext): Promise<void> {
  if (!canAccessPath("/exports", context.auth.session.capabilities)) {
    throw new HttpError(403, "Missing required controls capability");
  }

  if (context.req.method === "GET" && context.url.pathname === "/api/exports") {
    writeJson(context.res, 200, await context.deps.repository.listAvailableExports());
    return;
  }
  if (context.req.method === "POST" && context.url.pathname.startsWith(EXPORT_PREFIX)) {
    const body = await readJsonObject(context.req);
    const payload = await context.deps.repository.buildExport(
      decodeURIComponent(context.url.pathname.slice(EXPORT_PREFIX.length)),
      context.guildId,
      context.auth.session.user.id,
      typeof body.confirmation === "string" ? body.confirmation : undefined,
    );
    writeJson(context.res, 200, payload);
    return;
  }
  writeJson(context.res, 405, { error: "Method not allowed" });
}
