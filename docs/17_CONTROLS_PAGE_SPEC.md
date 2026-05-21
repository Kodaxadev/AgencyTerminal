# 17 — Controls Page Spec

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
public signup
billing
multi-tenant switching
marketplace installation
self-serve onboarding
public profile pages
chat/ticket replacement
contract negotiation UI
Signal Vault replacement
FrontierWarden replacement
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

MVP options, in order:

1. **Discord OAuth2 with guild role check** — best long-term internal option.
2. **Single operator password + IP allowlist** — fastest private prototype.
3. **Vercel deployment protection + app-level session** — acceptable if hosted privately.

Recommended v1:

```text
Discord OAuth2
→ check user is in configured guild
→ check mapped capability
→ allow controls page access
```

No public account creation.

## Page Map

```text
/controls
/controls/health
/controls/config
/controls/roles
/controls/metrics
/controls/evidence
/controls/tickets
/controls/audit
/controls/retention
/controls/exports
```

## Home: /controls

Display:

```text
Bot status
Discord connection
Database connection
Last command seen
Last background job run
Open tickets
Stale evidence count
Pending quorum count
Failed Discord projection count
Current guild
Configured channels
```

Status cards:

```text
STATUS // CODE 200 // OPERATIONAL
STATUS // CODE 206 // DEGRADED
STATUS // CODE 503 // ACTION REQUIRED
```

## Health: /controls/health

Checks:

```text
DISCORD_TOKEN present
DISCORD_CLIENT_ID present
DISCORD_GUILD_ID present
DATABASE_URL present
SUPABASE storage configured, if enabled
Bot can read guild
Bot can post to audit channel
Bot can post to ops queue
Required DB migrations applied
Background worker heartbeat fresh
```

Each check has:

```ts
type HealthCheck = {
  id: string;
  label: string;
  status: "ok" | "warn" | "fail";
  lastCheckedAt: string;
  detail?: string;
  remediation?: string;
};
```

## Config: /controls/config

Manage single-guild settings only:

```text
guild id
audit channel id
ops queue channel id
archive channel id
doctrine changes channel id
stale review hours
ticket archive behavior
transcript storage enabled
```

All changes write to `audit_log`.

## Roles: /controls/roles

Manage capabilities:

```text
can_view_all_tickets
can_validate_evidence
can_override_quorum
can_reverse_score
can_manage_clearance
can_manage_contracts
can_manage_intel
can_manage_config
```

UI pattern:

```text
Capability → Discord role selector → Save
```

No raw permission editing beyond these capabilities.

## Metrics: /controls/metrics

Manage fixed point table:

```text
metric category
base points
visibility: public/officer_only
enabled
version
```

Important rule:

Changing points creates a new metric config version. Existing score events retain their original `points_table_version`.

## Evidence: /controls/evidence

Views:

```text
Submitted
Under Review
Stale Review
Needs More Evidence
Validated
Rejected
Credited
Reversed
```

Actions:

```text
view evidence
view linked ticket
mark duplicate
request more evidence
force stale escalation
director override
```

Dangerous action:

```text
reverse score
```

Requires director + corroborating officer.

## Tickets: /controls/tickets

Controls page may inspect tickets but should not replace Discord.

Actions:

```text
view metadata
open Discord channel link
force archive
generate transcript
repair missing channel projection
```

## Audit: /controls/audit

Filters:

```text
actor
action
subject type
subject id
date range
sensitivity
```

Audit records are read-only in UI.

## Retention: /controls/retention

Actions:

```text
show policies
edit policy
run dry-run
run retention job
export affected rows
```

Destructive retention must require:

```text
dry-run first
explicit confirmation
audit log entry
```

## Exports: /controls/exports

Export buttons:

```text
ledger export
agent export
audit export
ticket export
retention report
```

Exports should be JSON first.

## Controls Page Technical Stack

Recommended:

```text
Vite + React + TypeScript
React Router
Tailwind
Server-side API via small Node/Express or Hono app
Postgres access through server only
Discord OAuth through server only
```

If using Vercel:

```text
web controls page: Vercel
bot worker/API: Railway
database: Supabase Postgres
```

If avoiding split hosting:

```text
bot + controls API + static controls build: Railway
```

For simplicity, v1 can serve controls from the same Railway service.

## Acceptance Criteria

- No page has tenant selection.
- No page references billing.
- No page supports public account creation.
- All controls page changes write audit events.
- Role/capability checks happen server-side.
- Dangerous actions require capability and confirmation.
- Controls page can be disabled entirely by env flag.
