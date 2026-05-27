/* eslint-disable no-console */
/**
 * Authorization matrix simulator.
 *
 * Plants real signed sessions in the production controls_sessions table with
 * synthetic users that hold the capabilities under test, then drives the
 * deployed /api endpoints with those sessions and asserts row visibility.
 *
 * No Discord OAuth is involved — we skip the OAuth handshake by writing a
 * session row directly. Every other code path (cookie signing/verification,
 * route gating, repository row filtering) runs exactly as it does for a real
 * Discord-authenticated user.
 *
 * Required environment (run `vercel env pull --environment=production
 * .env.production.local` from the repo root, then source it):
 *   DATABASE_URL                       — production Supabase connection
 *   CONTROLS_SESSION_SECRET            — production cookie HMAC secret
 *   CONTROLS_TOKEN_ENCRYPTION_SECRET   — production token encryption secret
 *   CONTROLS_PUBLIC_BASE_URL           — production controls base URL
 *
 * Prereq: scripts/fixtures/authorization_matrix.sql must have been run.
 *
 * Usage:
 *   pnpm exec tsx scripts/auth-matrix/run.ts
 */

import type { Capability } from "../../apps/controls/src/contracts";
import { PostgresSessionStore } from "../../apps/controls/server/auth/postgres-session";
import { signSessionId } from "../../apps/controls/server/auth/session";

const GUILD_ID = "1417305427766546567";
const SESSION_TTL_MS = 30 * 60 * 1000;

interface Seat {
  name: string;
  userId: string;
  capabilities: Capability[];
}

const SEATS: Seat[] = [
  { name: "recruiter",          userId: "matrix-seat-recruiter",          capabilities: ["can_manage_enlistment"] },
  { name: "contracts",          userId: "matrix-seat-contracts",          capabilities: ["can_manage_contracts"] },
  { name: "intel",              userId: "matrix-seat-intel",              capabilities: ["can_manage_intel"] },
  { name: "clearance",          userId: "matrix-seat-clearance",          capabilities: ["can_manage_clearance"] },
  { name: "validator",          userId: "matrix-seat-validator",          capabilities: ["can_validate_evidence"] },
  { name: "auditor",            userId: "matrix-seat-auditor",            capabilities: ["can_view_audit"] },
  { name: "viewer-all-tickets", userId: "matrix-seat-viewer-all-tickets", capabilities: ["can_view_all_tickets"] },
  { name: "config-admin",       userId: "matrix-seat-config-admin",       capabilities: ["can_manage_config"] },
];

interface Check {
  seat: string;
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  expectStatus: number;
  mustInclude?: string[];
  mustExclude?: string[];
}

const CHECKS: Check[] = [
  // Recruiter — only enlistment tickets visible on broad /api/tickets.
  { seat: "recruiter", path: "/api/tickets",       expectStatus: 200,
    mustInclude: ["MATRIX_TEST_ticket_enlistment_officer"],
    mustExclude: [
      "MATRIX_TEST_ticket_contract_officer", "MATRIX_TEST_ticket_contract_director",
      "MATRIX_TEST_ticket_intel_officer",    "MATRIX_TEST_ticket_intel_director",
      "MATRIX_TEST_ticket_clearance_officer","MATRIX_TEST_ticket_clearance_director",
      "MATRIX_TEST_ticket_general_officer",
    ] },
  { seat: "recruiter", path: "/api/evidence",  expectStatus: 403 },
  { seat: "recruiter", path: "/api/contracts", expectStatus: 403 },
  { seat: "recruiter", path: "/api/clearance", expectStatus: 403 },

  // Contracts handler — scoped /api/contracts shows non-director contract; director hidden.
  { seat: "contracts", path: "/api/contracts", expectStatus: 200,
    mustInclude: ["MATRIX_TEST_ticket_contract_officer"],
    mustExclude: ["MATRIX_TEST_ticket_contract_director"] },
  { seat: "contracts", path: "/api/tickets",   expectStatus: 403 },
  { seat: "contracts", path: "/api/evidence",  expectStatus: 403 },

  // Intel handler — scoped /api/evidence/intel shows non-director intel; director hidden.
  { seat: "intel", path: "/api/evidence/intel", expectStatus: 200,
    mustInclude: ["MATRIX_TEST_evidence_intel_officer"],
    mustExclude: [
      "MATRIX_TEST_evidence_intel_director",
      "MATRIX_TEST_evidence_contract_officer", "MATRIX_TEST_evidence_contract_director",
      "MATRIX_TEST_evidence_pvp_officer", "MATRIX_TEST_evidence_pvp_director",
    ] },
  { seat: "intel", path: "/api/evidence",  expectStatus: 403 },
  { seat: "intel", path: "/api/contracts", expectStatus: 403 },

  // Clearance handler — scoped /api/clearance shows non-director clearance; director hidden.
  { seat: "clearance", path: "/api/clearance", expectStatus: 200,
    mustInclude: ["MATRIX_TEST_ticket_clearance_officer"],
    mustExclude: ["MATRIX_TEST_ticket_clearance_director"] },
  { seat: "clearance", path: "/api/tickets",  expectStatus: 403 },
  { seat: "clearance", path: "/api/evidence", expectStatus: 403 },

  // Validator — broad /api/evidence shows all non-director rows across domains, no director.
  { seat: "validator", path: "/api/evidence", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_evidence_intel_officer",
      "MATRIX_TEST_evidence_contract_officer",
      "MATRIX_TEST_evidence_pvp_officer",
    ],
    mustExclude: [
      "MATRIX_TEST_evidence_intel_director",
      "MATRIX_TEST_evidence_contract_director",
      "MATRIX_TEST_evidence_pvp_director",
    ] },
  { seat: "validator", path: "/api/exports", expectStatus: 200,
    mustInclude: ['"type":"ledger"'],
    mustExclude: ['"type":"audit"', '"type":"tickets"', '"type":"retention"'] },
  { seat: "validator", path: "/api/tickets", expectStatus: 403 },

  // Auditor — broad cross-domain visibility, but director-only rows still blocked without per-domain sensitive caps.
  { seat: "auditor", path: "/api/evidence", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_evidence_intel_officer",
      "MATRIX_TEST_evidence_contract_officer",
      "MATRIX_TEST_evidence_pvp_officer",
    ],
    mustExclude: [
      "MATRIX_TEST_evidence_intel_director",
      "MATRIX_TEST_evidence_contract_director",
      "MATRIX_TEST_evidence_pvp_director",
    ] },
  { seat: "auditor", path: "/api/tickets", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_ticket_enlistment_officer",
      "MATRIX_TEST_ticket_contract_officer",
      "MATRIX_TEST_ticket_intel_officer",
      "MATRIX_TEST_ticket_clearance_officer",
      "MATRIX_TEST_ticket_general_officer",
    ],
    mustExclude: [
      "MATRIX_TEST_ticket_contract_director",
      "MATRIX_TEST_ticket_intel_director",
      "MATRIX_TEST_ticket_clearance_director",
    ] },
  { seat: "auditor", path: "/api/audit", expectStatus: 200 },
  { seat: "auditor", path: "/api/exports", expectStatus: 200,
    mustInclude: ['"type":"ledger"', '"type":"agents"', '"type":"audit"'],
    mustExclude: ['"type":"tickets"', '"type":"retention"'] },

  // viewer-all-tickets — broad tickets visible; director-only ones blocked.
  { seat: "viewer-all-tickets", path: "/api/tickets", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_ticket_enlistment_officer",
      "MATRIX_TEST_ticket_contract_officer",
      "MATRIX_TEST_ticket_intel_officer",
      "MATRIX_TEST_ticket_clearance_officer",
      "MATRIX_TEST_ticket_general_officer",
    ],
    mustExclude: [
      "MATRIX_TEST_ticket_contract_director",
      "MATRIX_TEST_ticket_intel_director",
      "MATRIX_TEST_ticket_clearance_director",
    ] },
  { seat: "viewer-all-tickets", path: "/api/exports", expectStatus: 200,
    mustInclude: ['"type":"tickets"'],
    mustExclude: ['"type":"ledger"', '"type":"audit"', '"type":"agents"', '"type":"retention"'] },
  { seat: "viewer-all-tickets", path: "/api/evidence", expectStatus: 403 },

  // config-admin — sees every fixture row across every page (control case).
  { seat: "config-admin", path: "/api/evidence", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_evidence_intel_officer",  "MATRIX_TEST_evidence_intel_director",
      "MATRIX_TEST_evidence_contract_officer","MATRIX_TEST_evidence_contract_director",
      "MATRIX_TEST_evidence_pvp_officer",    "MATRIX_TEST_evidence_pvp_director",
    ] },
  { seat: "config-admin", path: "/api/tickets", expectStatus: 200,
    mustInclude: [
      "MATRIX_TEST_ticket_enlistment_officer",
      "MATRIX_TEST_ticket_contract_officer",  "MATRIX_TEST_ticket_contract_director",
      "MATRIX_TEST_ticket_intel_officer",     "MATRIX_TEST_ticket_intel_director",
      "MATRIX_TEST_ticket_clearance_officer", "MATRIX_TEST_ticket_clearance_director",
      "MATRIX_TEST_ticket_general_officer",
    ] },
  { seat: "config-admin", path: "/api/exports", expectStatus: 200,
    mustInclude: ['"type":"ledger"', '"type":"agents"', '"type":"audit"', '"type":"tickets"', '"type":"retention"'] },
];

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
  // CONTROLS_TOKEN_ENCRYPTION_SECRET is read inside PostgresSessionStore via env.
  if (!process.env.CONTROLS_TOKEN_ENCRYPTION_SECRET && !process.env.CONTROLS_SESSION_SECRET) {
    throw new Error("Missing CONTROLS_TOKEN_ENCRYPTION_SECRET (or fallback CONTROLS_SESSION_SECRET)");
  }

  const store = new PostgresSessionStore();
  const sessionIds: string[] = [];
  const cookieBySeat = new Map<string, string>();

  console.log(`[matrix] planting ${SEATS.length} sessions on guild ${GUILD_ID}`);
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
    console.log(`[matrix]   ${seat.name.padEnd(20)} session ${session.id} caps=${seat.capabilities.join(",")}`);
  }

  const results: Result[] = [];
  for (const check of CHECKS) {
    const cookie = cookieBySeat.get(check.seat);
    if (!cookie) {
      results.push({ seat: check.seat, path: check.path, method: check.method ?? "GET", outcome: "fail", detail: "no cookie for seat" });
      continue;
    }
    const method = check.method ?? "GET";
    const init: RequestInit = { method, headers: { cookie } };
    if (check.body !== undefined) {
      init.body = JSON.stringify(check.body);
      (init.headers as Record<string, string>)["content-type"] = "application/json";
      (init.headers as Record<string, string>)["origin"] = baseUrl;
    }
    const res = await fetch(`${baseUrl}${check.path}`, init);
    const text = await res.text();
    const detail = evaluate(check, res.status, text);
    results.push({
      seat: check.seat,
      path: check.path,
      method,
      outcome: detail === null ? "pass" : "fail",
      detail: detail ?? undefined,
    });
  }

  console.log(`[matrix] cleaning up ${sessionIds.length} sessions`);
  for (const id of sessionIds) await store.delete(id);

  const passed = results.filter((r) => r.outcome === "pass").length;
  const failed = results.filter((r) => r.outcome === "fail");
  console.log(`\n[matrix] ${passed}/${results.length} checks passed`);
  for (const r of failed) {
    console.log(`  FAIL  ${r.seat.padEnd(20)} ${r.method} ${r.path}  — ${r.detail}`);
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

function evaluate(check: Check, status: number, body: string): string | null {
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

main().catch((error) => {
  console.error("[matrix] fatal:", error);
  process.exit(2);
});
