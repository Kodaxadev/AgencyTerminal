/* eslint-disable no-console */
/**
 * Authorization matrix simulator.
 *
 * Plants server-valid synthetic controls sessions using the same
 * cookie/session storage format as post-OAuth requests, drives the deployed
 * /api endpoints, and asserts row visibility, export body filtering,
 * export-field redaction, and export audit-row creation. Discord OAuth and
 * Discord membership refresh are intentionally bypassed.
 *
 * Required env: DATABASE_URL, CONTROLS_SESSION_SECRET,
 * CONTROLS_TOKEN_ENCRYPTION_SECRET, CONTROLS_PUBLIC_BASE_URL.
 *
 * Prereq: scripts/fixtures/authorization_matrix.sql must have been run.
 *
 * Cleanup: every planted session and any audit row produced by an export
 * during this run is deleted in a finally block, so a failure mid-matrix
 * cannot leave synthetic state behind.
 *
 * Usage:
 *   node --env-file=.env.production.local --import tsx scripts/auth-matrix/run.ts
 */

import { auditLog } from "../../packages/db/schema/drizzle-schema";
import { db } from "../../packages/db/src/client";
import { and, eq, gte, like } from "../../packages/db/src/query";
import { PostgresSessionStore } from "../../apps/controls/server/auth/postgres-session";
import { signSessionId } from "../../apps/controls/server/auth/session";
import { CHECKS, type Check } from "./checks";
import { SEATS, SEAT_USER_PREFIX } from "./seats";

const GUILD_ID = "1417305427766546567";
const SESSION_TTL_MS = 30 * 60 * 1000;

interface Result {
  seat: string;
  path: string;
  method: string;
  outcome: "pass" | "fail";
  detail?: string;
}

async function main(): Promise<void> {
  const baseUrl = requireEnv("CONTROLS_PUBLIC_BASE_URL").replace(/\/$/, "");
  const sessionSecret = requireEnv("CONTROLS_SESSION_SECRET");
  requireEnv("DATABASE_URL");
  if (!process.env.CONTROLS_TOKEN_ENCRYPTION_SECRET && !process.env.CONTROLS_SESSION_SECRET) {
    throw new Error("Missing CONTROLS_TOKEN_ENCRYPTION_SECRET (or fallback CONTROLS_SESSION_SECRET)");
  }

  const store = new PostgresSessionStore();
  const sessionIds: string[] = [];
  const matrixStartedAt = new Date();
  const results: Result[] = [];

  try {
    console.log(`[matrix] planting ${SEATS.length} sessions on guild ${GUILD_ID}`);
    const cookieBySeat = new Map<string, string>();
    const userIdBySeat = new Map<string, string>();
    for (const seat of SEATS) {
      const now = Date.now();
      const session = await store.create({
        user: { id: seat.userId, username: `matrix-${seat.name}`, globalName: `Matrix ${seat.name}` },
        guildId: GUILD_ID,
        discordRoleIds: [],
        capabilities: seat.capabilities,
        accessToken: `fake-access-${seat.name}`,
        refreshToken: `fake-refresh-${seat.name}`,
        tokenExpiresAt: now + SESSION_TTL_MS,
        validatedAt: now,
        expiresAt: now + SESSION_TTL_MS,
      });
      sessionIds.push(session.id);
      cookieBySeat.set(seat.name, `controls_session=${signSessionId(session.id, sessionSecret)}`);
      userIdBySeat.set(seat.name, seat.userId);
      console.log(`[matrix]   ${seat.name.padEnd(20)} caps=${seat.capabilities.join(",")}`);
    }

    for (const check of CHECKS) {
      results.push(await runCheck(check, baseUrl, cookieBySeat, userIdBySeat, matrixStartedAt));
    }
  } finally {
    await cleanup(store, sessionIds, matrixStartedAt);
  }

  const passed = results.filter((r) => r.outcome === "pass").length;
  const failed = results.filter((r) => r.outcome === "fail");
  console.log(`\n[matrix] ${passed}/${results.length} checks passed`);
  for (const r of failed) {
    console.log(`  FAIL  ${r.seat.padEnd(20)} ${r.method} ${r.path}  — ${r.detail}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

async function runCheck(
  check: Check,
  baseUrl: string,
  cookieBySeat: Map<string, string>,
  userIdBySeat: Map<string, string>,
  matrixStartedAt: Date,
): Promise<Result> {
  const method = check.method ?? "GET";
  const cookie = cookieBySeat.get(check.seat);
  const userId = userIdBySeat.get(check.seat);
  if (!cookie || !userId) {
    return { seat: check.seat, path: check.path, method, outcome: "fail", detail: "no session for seat" };
  }
  const init: RequestInit = { method, headers: { cookie } };
  if (check.body !== undefined) {
    init.body = JSON.stringify(check.body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
    (init.headers as Record<string, string>)["origin"] = baseUrl;
  }
  const res = await fetch(`${baseUrl}${check.path}`, init);
  const text = await res.text();
  let detail = evaluateBody(check, res.status, text);

  if (detail === null && check.audit !== undefined) {
    detail = await evaluateAudit(check, userId, matrixStartedAt);
  }

  return {
    seat: check.seat,
    path: check.path,
    method,
    outcome: detail === null ? "pass" : "fail",
    detail: detail ?? undefined,
  };
}

function evaluateBody(check: Check, status: number, body: string): string | null {
  if (status !== check.expectStatus) {
    return `expected ${check.expectStatus}, got ${status}; body=${body.slice(0, 200)}`;
  }
  for (const needle of check.mustInclude ?? []) {
    if (!body.includes(needle)) return `expected response to include ${needle}`;
  }
  for (const needle of check.mustExclude ?? []) {
    if (body.includes(needle)) return `response unexpectedly included ${needle}`;
  }
  return null;
}

async function evaluateAudit(check: Check, userId: string, matrixStartedAt: Date): Promise<string | null> {
  const expected = check.audit === "expect-row";
  const exportsPrefix = "/api/exports/";
  if (!check.path.startsWith(exportsPrefix)) {
    return `audit check configured but path is not /api/exports/<type>: ${check.path}`;
  }
  const subjectId = check.path.slice(exportsPrefix.length);
  const rows = await db.select().from(auditLog).where(and(
    eq(auditLog.action, "controls_export_created"),
    eq(auditLog.actorDiscordId, userId),
    eq(auditLog.subjectId, subjectId),
    gte(auditLog.createdAt, matrixStartedAt),
  ));
  if (expected && rows.length !== 1) {
    return `expected exactly 1 audit row for ${userId}/${subjectId}, found ${rows.length}`;
  }
  if (!expected && rows.length !== 0) {
    return `expected no audit row for ${userId}/${subjectId}, found ${rows.length}`;
  }
  return null;
}

async function cleanup(store: PostgresSessionStore, sessionIds: string[], matrixStartedAt: Date): Promise<void> {
  let cleanedSessions = 0;
  for (const id of sessionIds) {
    try {
      await store.delete(id);
      cleanedSessions++;
    } catch (error) {
      console.error(`[matrix] cleanup: failed to delete session: ${(error as Error).message}`);
    }
  }
  let cleanedAuditRows = 0;
  try {
    const result = await db.delete(auditLog).where(and(
      eq(auditLog.action, "controls_export_created"),
      like(auditLog.actorDiscordId, `${SEAT_USER_PREFIX}%`),
      gte(auditLog.createdAt, matrixStartedAt),
    )).returning({ id: auditLog.id });
    cleanedAuditRows = Array.isArray(result) ? result.length : 0;
  } catch (error) {
    console.error(`[matrix] cleanup: failed to delete audit rows: ${(error as Error).message}`);
  }
  console.log(`[matrix] cleaned ${cleanedSessions} sessions and ${cleanedAuditRows} export audit rows`);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

main().catch((error) => {
  console.error("[matrix] fatal:", error);
  process.exit(2);
});
