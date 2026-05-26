import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pool } from "../../../packages/db/src/client";
import { parseControlsGuilds } from "./auth/guilds";
import { HttpError, writeJson } from "./http-utils";

interface DatabaseDiagnostics {
  databaseUrlConfigured: boolean;
  databaseUrlScheme: string;
  controlsGuilds: Array<{ key: string; guildId: string }>;
  currentDatabase?: string;
  currentSchema?: string;
  searchPath?: string;
  roleMappingsTable?: string | null;
  controlsSessionsTable?: string | null;
  roleMappingCount?: number;
  diagnosticError?: SafeErrorDetails;
}

interface SafeErrorDetails {
  name?: string;
  code?: string;
  message: string;
}

export async function handleDatabaseDiagnostics(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  if (req.method !== "GET") return writeJson(res, 405, { error: "Method not allowed" });
  requireDiagnosticToken(req, env);

  const requestedGuildId = url.searchParams.get("guildId") ?? parseControlsGuilds(env)[0]?.guildId;
  const diagnostics: DatabaseDiagnostics = {
    databaseUrlConfigured: Boolean(env.DATABASE_URL),
    databaseUrlScheme: parseUrlScheme(env.DATABASE_URL),
    controlsGuilds: parseControlsGuilds(env),
  };

  try {
    const [state] = await pool`
      select
        current_database() as "currentDatabase",
        current_schema() as "currentSchema",
        current_setting('search_path') as "searchPath",
        to_regclass('public.role_mappings')::text as "roleMappingsTable",
        to_regclass('public.controls_sessions')::text as "controlsSessionsTable"
    `;
    Object.assign(diagnostics, state);

    if (requestedGuildId && diagnostics.roleMappingsTable) {
      const [count] = await pool`
        select count(*)::int as count
        from role_mappings
        where guild_id = ${requestedGuildId}
      `;
      diagnostics.roleMappingCount = Number(count?.count ?? 0);
    }
  } catch (error) {
    diagnostics.diagnosticError = toSafeErrorDetails(error);
  }

  writeJson(res, diagnostics.diagnosticError ? 500 : 200, diagnostics);
}

export function toSafeErrorDetails(error: unknown): SafeErrorDetails {
  if (!(error instanceof Error)) return { message: String(error) };
  const withCode = error as Error & { code?: string };
  return {
    name: error.name,
    code: withCode.code,
    message: error.message,
  };
}

function requireDiagnosticToken(req: IncomingMessage, env: NodeJS.ProcessEnv): void {
  const expected = env.CONTROLS_DIAGNOSTIC_TOKEN;
  const provided = req.headers["x-controls-diagnostic-token"];
  if (!expected || typeof provided !== "string" || !tokensMatch(expected, provided)) {
    throw new HttpError(404, "Not found");
  }
}

function tokensMatch(expected: string, provided: string): boolean {
  const expectedHash = createHash("sha256").update(expected).digest();
  const providedHash = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedHash, providedHash);
}

function parseUrlScheme(value: string | undefined): string {
  return value?.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1] ?? "<none>";
}
