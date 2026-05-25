# Phase 2.7 Deployment Readiness Gate

## Scope

Baseline: `main @ 7a8f775ad5df43f9d7a23a223232257a25dd9700`.

Purpose: define the evidence required before moving from controlled development
shadow-mode acceptance to a persistent development soak, and later from that
soak to any Agency-guild rollout.

This is a gate document only. It does not approve deployment, create runtime
configuration, change bot behavior, or begin new product functionality.

## Non-goals

- No code, migration, dependency, or command behavior changes.
- No score automation.
- No role creation, role assignment, or Discord authority mutation.
- No EVE Frontier integration.
- No controls-page expansion.
- No Agency-guild or production deployment approval.

## Two-Track Model

Phase 2.7 is split into two separate deployment-readiness tracks.

Track A is a persistent development shadow runtime gate. It may permit a
Railway-hosted development soak after the already-passed controlled acceptance.

Track B is an Agency-guild rollout readiness gate. It is a later decision that
requires Track A evidence plus target Agency-guild and production-database
evidence.

Track A passing does not pass Track B. Track A has no authority impact and must
not be described as production readiness.

## Track A - Persistent Development Shadow Runtime

### Purpose

Permit a persistent Railway-hosted bot soak test using the Kodaxa development
Discord guild and a dedicated disposable/development AgencyTerminal database.

Track A is intended to prove that the bot can run as a real hosted process
without relying on a local workstation. It does not authorize Agency-guild
deployment, authority-bearing use, or production readiness.

### Runtime Boundary

Required Track A target:

- Kodaxa development Discord guild;
- dedicated disposable/development AgencyTerminal database;
- Railway long-running worker;
- fixed private development ops queue by channel ID;
- no Agency guild;
- no production database;
- no authority impact.

Required Track A runtime policy:

```env
NODE_ENV=production
AGENCY_OPS_QUEUE_CHANNEL_ID=<verified private development channel ID>
AGENCY_ALLOW_OPS_QUEUE_SETUP=false
```

Development self-setup must remain disabled during Track A shadow-style runs.

### Hosting Evidence

The deployment owner must record:

- Railway project name and service name, without secrets;
- Git source branch and commit SHA;
- build command;
- start command for the bot process;
- whether the service is a shared monorepo service and, if so, its Railway
  service settings;
- restart policy and expected behavior after a crash;
- evidence that logs are visible to the operator;
- evidence that the bot survives a restart or redeploy without local manual
  shell intervention;
- rollback plan for stopping the hosted bot and returning to the prior known
  state.

Healthcheck caveat: do not rely on a healthcheck endpoint unless the bot
actually exposes the checked HTTP endpoint.

Track A go/no-go:

- GO only if the process starts from a clean Railway deployment and runs without
  local workstation dependency.
- NO-GO if operation depends on a local terminal, local `.env`, or manual bot
  restart from a developer workstation.

## Track B - Agency-Guild Rollout Readiness

### Purpose

Make a later rollout decision for the intended Agency guild and intended
AgencyTerminal production database after Track A evidence is complete.

Track B is the first gate that can approve Agency-guild or production
deployment.

### Deployment Boundary

Before any Agency deployment, the operator must prove:

- Track A evidence is complete and reviewed;
- the target Discord guild is the intended Agency guild;
- the target database is the intended AgencyTerminal production database;
- no development Discord IDs, disposable DB URLs, or scratch evidence records are
  carried into the production configuration;
- the configured ops queue is private and fixed by ID;
- development self-setup remains disabled.

Required Track B runtime policy:

```env
NODE_ENV=production
AGENCY_OPS_QUEUE_CHANNEL_ID=<verified private Agency channel ID>
AGENCY_ALLOW_OPS_QUEUE_SETUP=false
```

## Environment And Secrets Gate

Record environment status without printing secret values.

| Classification | Variables | Gate treatment |
| --- | --- | --- |
| Current startup-required by executable bot runtime | `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `DATABASE_URL` | Required for Track A and Track B execution. |
| Current security-policy required for shadow/production-style runs | `NODE_ENV=production`, `AGENCY_OPS_QUEUE_CHANNEL_ID=<verified private channel ID>`, `AGENCY_ALLOW_OPS_QUEUE_SETUP=false` | Required for Track A and Track B safety. |
| Conditional or future architecture variables | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AGENCY_ADMIN_CHANNEL_ID`, `AGENCY_AUDIT_CHANNEL_ID` | Do not block Track A merely because an unimplemented integration does not use them. |

Conditional variables must not be provisioned as high-privilege secrets until an
implemented runtime path requires them and the least-privilege decision is
reviewed. This is especially important for `SUPABASE_SERVICE_ROLE_KEY`.

Required evidence:

- secrets are stored in the hosting provider environment, not committed files;
- `.env` remains ignored and untracked;
- development guild IDs are absent from Track B production configuration;
- disposable database URLs are absent from Track B production configuration;
- Track A: one named development deployment owner is recorded;
- Track A: development bot token and development DB credential
  revocation/rotation procedure is documented and can be executed without
  retrieving secrets from chat logs or local shell history;
- Track B: at least two named Agency/production operators know how to revoke or
  rotate the bot token and database credential;
- Track B: escalation ownership for credential compromise is recorded.

Go/no-go:

- GO only if every currently required variable is present for the selected
  track and environment separation is proven without exposing secret values.
- NO-GO if any value must be copied from local shell history or chat logs.

## Database Gate

Postgres remains canonical; Discord messages and channels are projections.

Track A required evidence:

- development database owner is named;
- migrations `001` through `007` are applied with `pnpm verify:migrations`;
- schema state is verified against the repository migrations;
- application can connect using the hosted runtime identity;
- test-data retention or cleanup policy is recorded.

Track B additional required evidence:

- production database owner is named;
- migrations `001` through `007` are applied with `pnpm verify:migrations`;
- production schema state is verified against repository migrations;
- backup policy is recorded;
- restore procedure and expected downtime are recorded;
- retention and cleanup policy is approved;
- no direct manual writes are required to create operational ledger state.

Track A database go/no-go:

- GO only if migrations pass against the dedicated development AgencyTerminal
  database, the hosted runtime can connect with its deployed identity, and
  non-authoritative test-data retention/reset/cleanup disposition is recorded.
- NO-GO if the development schema has drifted outside migrations or test-data
  disposition is missing.

Track B database go/no-go:

- GO only if migrations pass against the intended production database, schema
  matches repository migrations, backup and restore procedure is recorded,
  expected restore downtime is recorded, no production schema drift outside
  migrations exists, and no unapproved manual writes are required to create
  operational ledger state.
- NO-GO if production backup/restore evidence is missing, production schema has
  drifted outside migrations, or operational ledger state requires unapproved
  manual writes.

## Discord Guild Gate

Required guild configuration for both tracks:

- bot is installed only in the intended guild for that track;
- slash commands are registered for that guild;
- configured ops queue exists and is private from `@everyone`;
- bot has view, send, and read-history access in ops queue;
- mapped reviewer and override roles have intended ops queue access;
- role mappings in the database are explicit and reviewed;
- no roles are created or assigned automatically by the bot;
- audit/admin channels are configured by ID and verified private where required
  by implemented runtime paths.

Required acceptance repeat in the target guild:

- real slash-command evidence receipt is ephemeral;
- receipt contains no review controls;
- raw evidence URL is not posted publicly;
- exactly one reviewer projection appears in the configured private ops queue;
- unauthorized review is denied with no mutation;
- self-review is denied with `evidence_review_rejected` audit;
- disclosed-conflict approval is denied with `evidence_review_rejected` audit;
- one-approval canonical metric validates after one eligible approval;
- two-approval canonical metric remains under review after one eligible approval;
- fail-closed configured queue test creates no alternate queue and posts no
  public evidence content.

Track B test-data disposition:

- Agency-guild acceptance fixtures must be isolated in a dedicated
  non-authoritative dataset; or
- they must be clearly labeled as test/non-authoritative evidence with retention
  or cleanup disposition recorded before authority-bearing use.

Go/no-go:

- Track A GO only if the development-guild acceptance repeat matches the
  controlled acceptance record and remains non-authoritative.
- Track B GO only if Agency-guild acceptance repeat matches Track A evidence and
  test-data disposition is recorded.
- NO-GO if any public/member-visible output exposes sensitive evidence content.

## Monitoring And Escalation Gate

Minimum monitoring evidence:

- deployment logs are accessible to named operators;
- structured diagnostics for ops queue rejection/setup failure are searchable;
- outbox failures can be inspected;
- stale alert failures remain retryable and visible;
- bot crash/restart events are visible;
- database connection failures are visible and fail closed;
- escalation owner is named for Discord permission drift, DB outage, and token
  compromise.

Minimum escalation policy:

- pause rollout on evidence leakage;
- pause rollout on private channel exposure;
- pause rollout on repeated outbox failures;
- pause rollout on stalled reviews;
- pause rollout on unauthorized quorum mutation;
- revoke/rotate secrets immediately on credential exposure.

## Rollback Gate

Before Track A or Track B deployment, record a rollback plan that includes:

- previous known-good commit SHA;
- how to stop the bot process;
- how to redeploy the previous commit;
- how to disable Discord command access if needed;
- how to preserve the append-only ledger without deleting rows;
- how to mark projections as failed/retryable rather than faking success;
- how to communicate downtime to operators.

Rollback must not include manual deletion of evidence, reviews, audit rows, or
outbox rows unless a later approved retention/correction procedure explicitly
covers it.

## Required Evidence Bundle

The deployment-readiness reviewer must receive:

- selected track: Track A or Track B;
- current commit SHA;
- clean working tree confirmation;
- `pnpm typecheck` result;
- `pnpm lint` result;
- `pnpm test:run` result;
- `pnpm build` result;
- `pnpm check:lines` result;
- `git diff --check` result;
- `pnpm verify:migrations` result against the intended database;
- runtime policy confirmation without secrets;
- Discord guild configuration checklist;
- live target-guild acceptance results;
- logs and restart evidence;
- rollback procedure;
- open risks and owner names.

## Decision

Phase 2.7 deployment readiness is not passed by creating this document.

Track A may proceed only after a follow-up acceptance record fills the Track A
gate with real development-hosting evidence and explicitly states:

```text
Phase 2.7 Track A persistent development shadow runtime: PASSED
```

Track B may proceed only after Track A has passed and a follow-up acceptance
record fills the Agency-guild rollout gate with real target-environment evidence
and explicitly states:

```text
Phase 2.7 Track B Agency-guild rollout readiness: PASSED
```

Until the relevant statement exists, that deployment track remains blocked.

## References

- Discord application interactions and commands:
  https://docs.discord.com/developers/platform/interactions
- Discord interaction responses and ephemeral message flag:
  https://docs.discord.com/developers/interactions/receiving-and-responding
- Discord channel permissions and permission overwrites:
  https://docs.discord.com/developers/topics/permissions
- Railway monorepo service deployment:
  https://docs.railway.com/guides/monorepo
- Railway variables:
  https://docs.railway.com/variables
- Railway logs:
  https://docs.railway.com/guides/logs
- Railway restart policy:
  https://docs.railway.com/deployments/restart-policy
- Railway healthchecks:
  https://docs.railway.com/reference/healthchecks
- Supabase database migrations:
  https://supabase.com/docs/guides/deployment/database-migrations
- Supabase deployment environments:
  https://supabase.com/docs/guides/deployment/
- Supabase backups:
  https://supabase.com/docs/guides/platform/backups
