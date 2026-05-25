# Phase 2.7 Deployment Readiness Gate

## Scope

Baseline: `main @ 7a8f775ad5df43f9d7a23a223232257a25dd9700`.

Purpose: define the evidence required before moving from controlled development
shadow-mode acceptance to any persistent deployment or Agency-guild rollout.

This is a gate document only. It does not approve deployment, create runtime
configuration, change bot behavior, or begin new product functionality.

## Non-goals

- No code, migration, dependency, or command behavior changes.
- No score automation.
- No role creation, role assignment, or Discord authority mutation.
- No EVE Frontier integration.
- No controls-page expansion.
- No production or Agency-guild deployment.

## Deployment Boundary

Phase 2.6.1 acceptance proved the current integrity controls in the Kodaxa
development guild against disposable AgencyTerminal development infrastructure.
That evidence is not production evidence and is not Agency-guild evidence.

Before any Agency deployment, the operator must prove:

- the target Discord guild is the intended Agency guild;
- the target database is the intended AgencyTerminal production database;
- no development Discord IDs, disposable DB URLs, or scratch evidence records are
  carried into the production configuration;
- the configured ops queue is private and fixed by ID;
- development self-setup remains disabled.

Required runtime policy:

```env
NODE_ENV=production
AGENCY_OPS_QUEUE_CHANNEL_ID=<verified private Agency channel ID>
AGENCY_ALLOW_OPS_QUEUE_SETUP=false
```

## Hosting Runtime Gate

The documented v1 runtime target remains a long-running Railway worker. The
deployment owner must record the exact service and commands before launch:

- Railway project name and service name, without secrets.
- Git source branch and commit SHA.
- Build command.
- Start command for the bot process.
- Whether the service is a shared monorepo service and, if so, its Railway
  service settings.
- Restart policy and expected behavior after a crash.
- How logs will be viewed by operators.
- Whether a healthcheck is configured. If a healthcheck is used, the bot must
  actually expose the checked HTTP endpoint before relying on it.

Go/no-go:

- GO only if the process can start from a clean deployment without local files,
  local shells, or manual bot restarts.
- NO-GO if the bot only runs from a local developer workstation.

## Environment And Secrets Gate

Record required variables as present in the deployment environment without
printing their values:

```env
DISCORD_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
AGENCY_ADMIN_CHANNEL_ID
AGENCY_AUDIT_CHANNEL_ID
AGENCY_OPS_QUEUE_CHANNEL_ID
AGENCY_ALLOW_OPS_QUEUE_SETUP=false
NODE_ENV=production
```

Required evidence:

- secrets are stored in the hosting provider environment, not committed files;
- `.env` remains ignored and untracked;
- development guild IDs are absent from the production environment;
- disposable database URLs are absent from the production environment;
- token rotation owner and procedure are recorded;
- at least two operators know how to revoke the bot token and database secret.

Go/no-go:

- GO only if every required variable is present and environment separation is
  proven without exposing secret values.
- NO-GO if any value must be copied from local shell history or chat logs.

## Database Gate

Postgres remains canonical; Discord messages and channels are projections.

Required evidence:

- production database owner is named;
- migrations `001` through `007` are applied with `pnpm verify:migrations`;
- schema state is verified against the repository migrations;
- application can connect using the production deployment identity;
- backup policy is recorded;
- restore procedure and expected downtime are recorded;
- retention and cleanup policy for test data is approved;
- no direct manual writes are required to create operational ledger state.

Go/no-go:

- GO only if migrations pass on the intended database and rollback/restore steps
  are documented before live evidence enters the ledger.
- NO-GO if production schema has been changed outside migrations.

## Discord Guild Gate

Required guild configuration:

- bot is installed only in the intended Agency guild for the rollout;
- slash commands are registered for that guild;
- configured ops queue exists and is private from `@everyone`;
- bot has view, send, and read-history access in ops queue;
- mapped reviewer and override roles have intended ops queue access;
- role mappings in the database are explicit and reviewed;
- no roles are created or assigned automatically by the bot;
- audit/admin channels are configured by ID and verified private where required.

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

Go/no-go:

- GO only if the Agency-guild acceptance repeat matches the development
  acceptance record.
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

Before deployment, record a rollback plan that includes:

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
- rollback procedure;
- open risks and owner names.

## Decision

Phase 2.7 deployment readiness is not passed by creating this document.

Deployment may proceed only after a follow-up acceptance record fills this gate
with real target-environment evidence and explicitly states:

```text
Phase 2.7 deployment readiness: PASSED
```

Until then, Agency-guild and production deployment remain blocked.

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
