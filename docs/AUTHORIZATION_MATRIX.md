# Authorization matrix — live role-based acceptance test

Independent verification that the deployed Controls surface enforces domain-aware
row-level visibility for the broad evidence and ticket endpoints and for exports.
This document is what an operator runs to clear "live authorization acceptance"
before any real Agency data is loaded into ATCC.

The corresponding code under test:

- [http.ts:148-156](../apps/controls/server/http.ts#L148) — broad endpoint handlers pass session capabilities into the repository.
- [repository.ts:230-275](../apps/controls/server/repository.ts#L230) — row filtering for evidence/tickets.
- [queue-scope.ts:40-101](../apps/controls/server/queue-scope.ts#L40) — domain and sensitivity decisions.
- [export-repository.ts](../apps/controls/server/export-repository.ts), [export-service.ts](../apps/controls/server/export-service.ts) — per-type capability + per-row filtering on exports.

## Prerequisites

1. Test guild: `1417305427766546567` (`Agency Terminal Discord Smoke`).
2. Eight Discord accounts in the test guild, each holding **only** the named capability via a role mapped in `role_mappings`. No super-caps (no `can_manage_config`, no `can_view_audit`, no `can_view_all_tickets`) except where the seat explicitly names them.

| Seat | Discord account | Role | Mapped capability |
|---|---|---|---|
| `recruiter` | (assign) | (assign) | `can_manage_enlistment` |
| `contracts` | (assign) | (assign) | `can_manage_contracts` |
| `intel` | (assign) | (assign) | `can_manage_intel` |
| `clearance` | (assign) | (assign) | `can_manage_clearance` |
| `validator` | (assign) | (assign) | `can_validate_evidence` |
| `auditor` | (assign) | (assign) | `can_view_audit` |
| `viewer-all-tickets` | (assign) | (assign) | `can_view_all_tickets` |
| `config-admin` | (assign) | (assign) | `can_manage_config` (control) |

3. Vercel Production deployment serving `c1ea8af` or later.
4. Bot worker online (verify with `SELECT NOW() - last_seen_at FROM worker_heartbeats;` — staleness should be under one minute).

## Step 1 — Seed deterministic fixture rows

Run the fixture against the deployed database:

```bash
psql "$DATABASE_URL" -f scripts/fixtures/authorization_matrix.sql
```

Expected output:
```
 table_name | rows
------------+------
 evidence   |    6
 tickets    |   10
```

The fixture seeds:

**Evidence (6 rows):**
| Title suffix | metric_category | sensitivity |
|---|---|---|
| `intel_officer` | intelligence_acquisitions | officer_only |
| `intel_director` | intelligence_acquisitions | director_only |
| `contract_officer` | contracts_completed | officer_only |
| `contract_director` | contracts_completed | director_only |
| `pvp_officer` | pvp_kill_value | officer_only |
| `pvp_director` | pvp_kill_value | director_only |

**Tickets (10 rows):**
| Title suffix | type | sensitivity |
|---|---|---|
| `enlistment_officer` | enlistment | officer_only |
| `contract_officer` | contract | officer_only |
| `contract_director` | contract | director_only |
| `intel_officer` | intel | officer_only |
| `intel_director` | intel | director_only |
| `clearance_officer` | clearance | officer_only |
| `clearance_director` | clearance | director_only |
| `performance_member` | performance_evidence | member |
| `doctrine_member` | doctrine_challenge | member |
| `general_officer` | general | officer_only |

All fixture rows are titled `MATRIX_TEST_*` so they can be visually distinguished from real data and cleaned up by suffix.

## Step 2 — Matrix tests

For each seat:
1. Sign in as the seat's Discord account at the deployed Controls URL.
2. Open each page listed under "must include" and confirm every named row title appears.
3. Open each page listed under "must NOT include" and confirm none of the named row titles appear.
4. Record pass/fail in [Step 4](#step-4--record-results).

If your account lands with extra capabilities you didn't expect, fix the role_mapping before running — the seat's row visibility predictions depend on holding *only* the named cap.

### Seat: `recruiter` (`can_manage_enlistment` only)

Pages reachable: `/tickets`, `/exports` (none — see below).

| Page | Must include | Must NOT include |
|---|---|---|
| `/tickets` (broad) | `enlistment_officer` | `contract_officer`, `contract_director`, `intel_officer`, `intel_director`, `clearance_officer`, `clearance_director`, `general_officer` |

`/evidence`, `/contracts`, `/clearance`, `/exports` — should all return 403 or redirect (page-level access denied).

### Seat: `contracts` (`can_manage_contracts` only)

Pages reachable: `/contracts`, `/tickets` (if also `can_view_all_tickets`, which this seat does not have).

| Page | Must include | Must NOT include |
|---|---|---|
| `/contracts` (scoped) | `MATRIX_TEST_ticket_contract_officer` | `MATRIX_TEST_ticket_contract_director` (no `can_view_sensitive_contracts`) |

`/tickets` should be 403 (this seat doesn't have `can_view_all_tickets` or `can_manage_enlistment`).
`/evidence` should be 403.

### Seat: `intel` (`can_manage_intel` only)

| Page | Must include | Must NOT include |
|---|---|---|
| `/evidence/intel` (scoped) | `evidence_intel_officer` | `evidence_intel_director` (no `can_view_sensitive_intel`), and any non-intel evidence (contract_*, pvp_*) |

`/evidence` (broad) requires `can_validate_evidence` — should be 403.
`/contracts`, `/clearance` — 403.

### Seat: `clearance` (`can_manage_clearance` only)

| Page | Must include | Must NOT include |
|---|---|---|
| `/clearance` (scoped) | `ticket_clearance_officer` | `ticket_clearance_director` (only `can_manage_config` admits this) |

`/tickets`, `/evidence`, `/contracts` — 403.

### Seat: `validator` (`can_validate_evidence` only)

| Page | Must include | Must NOT include |
|---|---|---|
| `/evidence` (broad) | `evidence_intel_officer`, `evidence_contract_officer`, `evidence_pvp_officer` | All `*_director` evidence (no per-domain sensitive caps held) |
| `/exports` listing | `ledger` only | `agents`, `audit`, `tickets`, `retention` |

`/tickets`, `/contracts`, `/clearance`, `/evidence/intel` — 403.

### Seat: `auditor` (`can_view_audit` only)

| Page | Must include | Must NOT include |
|---|---|---|
| `/audit` | (all audit rows; verify table renders) | — |
| `/evidence` (broad) | All six rows (cross-domain super-cap) | — |
| `/tickets` (broad) | All ten rows (cross-domain super-cap) | — |
| `/exports` listing | `ledger`, `agents`, `audit` | `tickets`, `retention` |

Note: `can_view_audit` is treated as a cross-domain super-cap for evidence and tickets by `canSeeEvidenceDomain` and `canSeeTicketDomain`. Director-only rows are still gated per-domain — auditor with no per-domain sensitive cap will not see `*_director` evidence/tickets unless they also hold the relevant `can_view_sensitive_*`. Verify: auditor sees non-director rows from every domain but not the director-only rows.

### Seat: `viewer-all-tickets` (`can_view_all_tickets` only)

| Page | Must include | Must NOT include |
|---|---|---|
| `/tickets` (broad) | All non-director ticket rows | `contract_director`, `intel_director`, `clearance_director` (no sensitive caps held) |
| `/exports` listing | `tickets` only | `ledger`, `agents`, `audit`, `retention` |

### Seat: `config-admin` (`can_manage_config` — control case)

| Page | Must include | Must NOT include |
|---|---|---|
| Every page | All fixture rows | — |
| `/exports` listing | All five export types | — |

This is the "see everything" control. If `config-admin` does *not* see every fixture row, there's a different bug.

## Step 3 — Export-payload verification

For each export type, log in as a seat authorized for that type, run the export, and verify:

| Export type | Run as | Expected included rows | Expected redacted fields | Expected NOT included |
|---|---|---|---|---|
| `ledger` | `validator` | `MATRIX_TEST_evidence_*_officer` (3 rows) | `description`, `parsed_summary`, `payload`, `url`, `walletAddress`, `paymentTerms`, etc. — replaced with `[REDACTED]` | `MATRIX_TEST_evidence_*_director` rows |
| `tickets` | `viewer-all-tickets` | All non-director ticket rows | `summary`, `paymentTerms`, `walletAddress`, etc. | `*_director` rows |
| `audit` | `auditor` | All audit rows | High-risk fields per [export-service.ts:16-47](../apps/controls/server/export-service.ts#L16) | — |
| `agents` | `auditor` | (zero rows expected — no fixture score events) | — | — |
| `retention` | `config-admin` | Retention policy rows | — | — |

For each export, verify:
1. HTTP 200 with a JSON payload.
2. `payload.sensitivity` matches the descriptor.
3. `payload.recordCount` matches `rows.length`.
4. Every row's high-risk fields are `[REDACTED]` (or null/empty).
5. No row tagged with a sensitivity the caller cannot view.

Attempting an unauthorized export must return HTTP **403** with `{"error":"Missing required controls capability"}`. Test cases:

- `recruiter` POST `/api/exports/tickets` → 403.
- `validator` POST `/api/exports/audit` → 403.
- `auditor` POST `/api/exports/tickets` → 403.
- `viewer-all-tickets` POST `/api/exports/audit` → 403.

## Step 4 — Audit-log verification

Each successful export must write an `audit_log` row. After the Step 3 exports complete, run:

```sql
SELECT
  created_at,
  actor_discord_id,
  action,
  subject_type,
  subject_id,
  sensitivity,
  payload
FROM audit_log
WHERE guild_id = '1417305427766546567'
  AND action = 'controls_export_created'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

Expected: one row per successful export from Step 3, with:
- `actor_discord_id` matching the seat that ran the export
- `subject_id` matching the export type (`ledger`, `tickets`, `audit`, `agents`, `retention`)
- `sensitivity = 'officer_only'` (audit-log row sensitivity, fixed by [export-repository.ts:78-89](../apps/controls/server/export-repository.ts#L78))
- `payload->>'recordCount'` matching the exported row count
- `payload->>'sensitivity'` matching the export's declared sensitivity (`director_only` for ledger/tickets/audit, `officer_only` for agents/retention)

Failed-export attempts must NOT appear in this query — the audit row is written after successful build, so 403s are correctly omitted.

## Step 5 — Record results

For each seat × page pair in Step 2, and each export in Step 3:

| Result | Meaning |
|---|---|
| ✅ Pass | Every expected row present, every forbidden row absent. |
| ❌ Fail | Any unexpected presence or absence — capture seat, page, row title, and the actual response. |

A single ❌ blocks loading real Agency data. Re-open the corresponding finding from the security review and treat as a new defect.

## Step 6 — Cleanup

After the run:

```bash
psql "$DATABASE_URL" -f scripts/fixtures/authorization_matrix_cleanup.sql
```

Expected output:
```
 table_name | remaining
------------+-----------
 evidence   |         0
 tickets    |         0
```

The fixture rows are removed by their `MATRIX_TEST_%` title prefix. No other data is touched.

## What this test does and does not prove

**Proves:**
- The deployed code paths in `repository.ts` and `queue-scope.ts` execute in production as expected against real session capabilities.
- Per-domain `director_only` rules deny cross-domain access.
- Per-type export capabilities + per-record export filtering deny unauthorized data export.
- The audit log records every export.

**Does not prove:**
- Anything about workflows the fixture doesn't exercise (ticket transitions, score reversal, appeals, retention runs, etc.) — those are separate roadmap items.
- That the bot worker behavior is correct end-to-end — only that the controls API enforces row visibility correctly.
- That the test discord accounts cannot escalate their own capabilities by other means — assumes role_mapping integrity.
