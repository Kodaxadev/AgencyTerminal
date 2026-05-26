# Controls Page

## Purpose

The controls page is not a SaaS dashboard. It is an internal operator console for the Agency Terminal bot.

Primary jobs:
1. Verify bot health.
2. Configure one Agency Discord guild.
3. Manage role-to-capability mappings.
4. Review stuck evidence and stale queues.
5. Inspect audit logs.
6. Export ledger data.
7. Run retention dry-runs.

## Non-Goals

The controls page does not include:
```text
public signup, billing, multi-tenant switching, marketplace installation,
self-serve onboarding, public profile pages, chat/ticket replacement,
contract negotiation UI, Signal Vault replacement, FrontierWarden replacement
```

## Users

| User | Access | Purpose |
|---|---|---|
| Operator | Full | Deploy, configure, repair |
| Director | Full except secrets | Review trust-sensitive state |
| Handler | Evidence/queues/profile/audit | Resolve operational workflow |
| Intel Officer | Intel queue only | Review sensitive intel |
| Recruiter | Enlistment queue only | Review applicants |
| Read-only Auditor | Audit/export only | Review past actions |

## Authentication

Recommended v1:
```text
Discord OAuth2
→ check user is in one configured controls guild
→ check mapped capability
→ allow controls page access
```

No public account creation. MVP alternatives: single operator password + IP allowlist (fastest private prototype), or Vercel deployment protection + app-level session.

Required controls environment:
```text
CONTROLS_ENABLED=true
CONTROLS_SESSION_SECRET=<strong random secret>
CONTROLS_PUBLIC_BASE_URL=<public controls origin>
DISCORD_CLIENT_SECRET=<Discord OAuth2 client secret>
DISCORD_REDIRECT_URI=<optional explicit callback URI>
```

Single-guild legacy mode uses `DISCORD_GUILD_ID` and
`CONTROLS_BOOTSTRAP_DISCORD_IDS`.

Dual-guild mode is explicit:
```text
CONTROLS_GUILDS=dev:<kodaxa dev guild id>,agency:<agency guild id>
CONTROLS_BOOTSTRAP_DISCORD_IDS_DEV=<developer discord user id>
CONTROLS_BOOTSTRAP_DISCORD_IDS_AGENCY=<leader discord user id>
```

In dual-guild mode, legacy `CONTROLS_BOOTSTRAP_DISCORD_IDS` is ignored so a dev
bootstrap ID cannot accidentally grant Agency authority. The session stores the
resolved guild ID, and all protected controls actions use that session guild.
The bot token and OAuth client secret remain server-side only.

## Page map

```text
/controls
/controls/health
/controls/config
/controls/roles
/controls/metrics
/controls/evidence
/controls/evidence/intel
/controls/contracts
/controls/clearance
/controls/tickets
/controls/audit
/controls/retention
/controls/exports
```

## Access scoping

### Page capabilities

| Page | Required capability |
|---|---|
| `/controls` | at least one controls-visible capability |
| `/controls/health` | `can_manage_config` |
| `/controls/config` | `can_manage_config` |
| `/controls/roles` | `can_manage_config` |
| `/controls/metrics` | `can_manage_config` |
| `/controls/evidence` | `can_validate_evidence` |
| `/controls/evidence/intel` | `can_manage_intel` |
| `/controls/contracts` | `can_manage_contracts` |
| `/controls/clearance` | `can_manage_clearance` |
| `/controls/audit` | `can_view_audit` or `can_manage_config` |
| `/controls/retention` | `can_manage_config` |
| `/controls/exports` | `can_manage_config` |

### Dataset filters

Even if a user can access a page, they see only records matching their scope:

```text
Recruiter:         Can see enlistment tickets only.
Intel Officer:     Can see intel tickets and intelligence evidence only.
Contract Officer:  Can see contract tickets and contract details only.
Handler:           Can see general evidence review queues except director_only records.
Director:          Can see all records.
```

Dataset filtering happens server-side.

## Home: /controls

Display:
```text
Bot status, Discord connection, Database connection
Last command seen, Last background job run
Open tickets, Stale evidence count, Pending quorum count
Discord outbox pending/dead count
Current guild, Configured channels
```

Status cards: `CODE 200 // OPERATIONAL`, `CODE 206 // DEGRADED`, `CODE 503 // ACTION REQUIRED`

## Health: /controls/health

Each check has: `id, label, status ("ok" | "warn" | "fail"), lastCheckedAt, detail?, remediation?`

Checks: DISCORD_TOKEN present, DISCORD_CLIENT_ID present, DATABASE_URL present, configured controls guild present, SUPABASE storage configured, Bot can read guild, Bot can post to audit channel, Bot can post to ops queue, Required DB migrations applied, Background worker heartbeat fresh.

## Config: /controls/config

Manage single-guild settings: guild id, admin channel id, audit channel id, ops queue channel id, archive channel id, doctrine changes channel id, stale review hours, ticket archive behavior, transcript storage enabled. All changes write to `audit_log`.

`AGENCY_ALLOW_OPS_QUEUE_SETUP` is shown as a health/policy signal, not a production web toggle. It should remain disabled outside development; a future repair action must be explicit, audited, and scoped to the selected guild.

`DISCORD_ENABLE_GUILD_MEMBERS_INTENT` is opt-in. The Agency leader must enable the privileged Guild Members intent in the Discord Developer Portal before join/enlistment automation is turned on.

## Roles: /controls/roles

Manage capabilities:
```text
can_manage_enlistment, can_manage_contracts, can_manage_intel,
can_manage_clearance, can_validate_evidence, can_view_audit,
can_manage_config, can_override_quorum, can_reverse_score,
can_backfill_evidence, can_review_appeals
```

UI pattern: `Capability → Discord role selector → Save`

## Metrics: /controls/metrics

Manage fixed point table: metric category, base points, visibility (public/officer_only), enabled, version.

Important rule: Changing points creates a new metric config version. Existing score events retain their original `points_table_version`.

## Evidence: /controls/evidence

Views: Submitted, Under Review, Stale Review, Needs More Evidence, Validated, Rejected, Credited, Reversed.

Actions: view evidence, view linked ticket, mark duplicate, request more evidence, force stale escalation, director override.

Dangerous action: `reverse score` — requires director + corroborating officer.

## Tickets: /controls/tickets

Controls page may inspect tickets but should not replace Discord.

Actions: view metadata, open Discord channel link, force archive, generate transcript, repair missing channel projection.

## Audit: /controls/audit

Filters: actor, action, subject type, subject id, date range, sensitivity. Audit records are read-only in UI.

## Retention: /controls/retention

Actions: show policies, edit policy, run dry-run, run retention job, export affected rows.

Destructive retention must require: dry-run first, explicit confirmation, audit log entry.

## Exports: /controls/exports

Export buttons: ledger export, agent export, audit export, ticket export, retention report. Exports should be JSON first.

## Technical stack

Recommended: Vite + React + TypeScript, React Router, Tailwind, server-side API via small Node/Express or Hono app, Postgres access through server only, Discord OAuth through server only.

For simplicity, v1 can serve controls from the same Railway service as the bot.

## Acceptance Criteria

- No page has tenant selection, billing, or public account creation.
- All controls page changes write audit events.
- Role/capability checks happen server-side.
- Dangerous actions require capability and confirmation.
- Controls page can be disabled entirely by env flag.
- Recruiter cannot see intel records. Intel officer cannot see contract payment terms unless separately authorized. Director can see all records.
