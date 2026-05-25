# Phase 2.7 Track A Evidence Preparation

## Scope

Baseline inspected: `main @ 64122d129c3d8f1ec8419f9e4e505a2458543596`.

Purpose: prepare the evidence plan for Track A persistent development shadow
runtime without starting a hosted worker, changing code, or changing deployment
configuration.

Track A target remains:

- Kodaxa development Discord guild;
- dedicated disposable/development AgencyTerminal database;
- Railway long-running worker;
- fixed private development ops queue by channel ID;
- no Agency guild;
- no production database;
- no authority impact.

This document does not pass Track A and does not approve deployment.

## Local Repository Findings

Current local inspection found:

- no checked-in `railway.json`;
- no checked-in `nixpacks.toml`;
- no checked-in `Dockerfile`;
- no checked-in `.railway` project link;
- Railway CLI is installed locally as `railway 4.44.0`;
- `railway status` reports no linked project for this working directory;
- executable bot startup currently requires `DISCORD_TOKEN`,
  `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, and `DATABASE_URL`;
- Track A security policy additionally requires `NODE_ENV=production`,
  `AGENCY_OPS_QUEUE_CHANNEL_ID=<verified private development channel ID>`, and
  `AGENCY_ALLOW_OPS_QUEUE_SETUP=false`.

Implication: the Track A Railway project/service either does not exist locally
or has not been linked to this checkout. Project/service existence must be
confirmed in Railway before a deployment attempt.

## Railway Project And Service Evidence

Before any hosted worker starts, record:

- Railway project name, without secrets;
- Railway service name, without secrets;
- whether the project already existed or was newly created;
- environment name used for the development shadow runtime;
- linked GitHub repository and branch;
- service root directory;
- build command;
- start command;
- restart policy;
- log access method;
- rollback owner.

No Railway project creation, service creation, link, restart, redeploy, or
variable mutation is approved by this preparation document.

Open question to resolve during the reviewed setup step:

- Because the local checkout is not linked to a Railway project, the operator
  must decide whether to link an existing AgencyTerminal development service or
  create a new dedicated development service.

## Candidate Build And Start Configuration

Candidate monorepo root: repository root.

Candidate build command:

```powershell
pnpm install --frozen-lockfile
pnpm build
```

Candidate start command:

```powershell
pnpm --filter @agency-terminal/bot start
```

Important runtime caveat:

- `apps/bot/package.json` defines `start` as `tsx src/index.ts`.
- The repository `build` command currently typechecks packages and does not emit
  compiled JavaScript.
- Track A must prove that the Railway runtime installs and can execute the
  current `tsx`-based start path before the service is considered stable.
- If Railway cannot run this start path cleanly, that is a Track A setup defect
  to review separately, not something to patch during this preparation pass.

Healthcheck caveat:

- Do not configure or rely on a Railway healthcheck unless the bot runtime
  actually exposes the checked HTTP endpoint.

## Environment Inventory

Record presence only. Do not print values.

| Classification | Variables | Track A treatment |
| --- | --- | --- |
| Startup-required by executable bot runtime | `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `DATABASE_URL` | Required before the hosted bot can start. |
| Shadow-style security policy | `NODE_ENV=production`, `AGENCY_OPS_QUEUE_CHANNEL_ID=<verified private development channel ID>`, `AGENCY_ALLOW_OPS_QUEUE_SETUP=false` | Required before any Track A worker starts. |
| Optional database tuning | `DB_MAX_CONNECTIONS` | Optional; default runtime behavior uses `1` when unset. |
| Conditional or future architecture variables | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AGENCY_ADMIN_CHANNEL_ID`, `AGENCY_AUDIT_CHANNEL_ID` | Do not block Track A merely because unimplemented paths do not use them. Do not provision high-privilege secrets until needed and reviewed. |

Track A secret-handling requirements:

- one named development deployment owner is recorded;
- development bot token revocation/rotation steps are documented;
- development DB credential revocation/rotation steps are documented;
- no secret values are copied from chat logs or local shell history;
- `.env` remains local, ignored, and untracked.

## Development Database Evidence Plan

Before Track A starts, record:

- database type as dedicated development AgencyTerminal PostgreSQL/Supabase
  infrastructure, without connection string;
- database owner;
- whether the database is disposable, resettable, or retained for soak history;
- test-data retention/reset/cleanup disposition;
- migration result from `pnpm verify:migrations`;
- confirmation that migrations `001` through `007` are applied;
- confirmation that the hosted runtime identity can connect;
- confirmation that the database is not the Agency production database.

Track A database go/no-go:

- GO only if migrations pass against the dedicated development database, hosted
  runtime connectivity is proven, and non-authoritative test-data disposition is
  recorded.
- NO-GO if database identity is ambiguous, migrations fail, or test-data
  disposition is missing.

## Kodaxa Development Discord Evidence Plan

Before Track A starts, record:

- development guild identity, without exposing unnecessary IDs in public docs;
- configured private ops queue identity, without exposing unnecessary IDs in
  public docs;
- `@everyone` cannot view the ops queue;
- bot can view, send, and read history in the ops queue;
- mapped reviewer/override test roles can view, send, and read history in the
  ops queue;
- role mappings are explicit database rows and are not mutated by the bot;
- `AGENCY_ALLOW_OPS_QUEUE_SETUP=false` is present in Railway variables;
- no alternate ops queue is created or repaired automatically.

Track A acceptance repeat after hosted start:

- submit harmless evidence through the real slash command;
- confirm the submitter receipt is ephemeral;
- confirm the receipt has no review controls;
- confirm no raw evidence URL appears publicly;
- confirm exactly one reviewer projection appears in the private ops queue;
- confirm unauthorized review is denied with no mutation;
- confirm self-review is denied with rejection audit;
- confirm disclosed-conflict approval is denied with rejection audit;
- confirm one-approval evidence validates after one eligible approval;
- confirm two-approval evidence remains under review after one eligible approval;
- confirm fail-closed unsafe ops queue behavior without creating an alternate
  queue or posting public evidence content.

## Logs And Restart Evidence Plan

Before Track A can pass, capture:

- hosted service deployment status;
- initial startup log showing bot online without secret values;
- startup failure log if a required variable is absent, using a disposable test
  environment only;
- outbox processor log visibility;
- structured ops queue rejection diagnostics visibility;
- service restart or redeploy evidence;
- confirmation that the bot resumes without a local workstation process;
- confirmation that no duplicate reviewer projection is created after restart.

Evidence commands should avoid printing secret values. Railway logs and status
should be captured with bounded output.

## Rollback Plan Required Before Start

Before the hosted worker starts, record:

- previous known-good commit SHA;
- command or dashboard action to stop the Railway service;
- command or dashboard action to redeploy the previous commit;
- how to disable Discord command access if needed;
- how to preserve the append-only ledger without deleting rows;
- how to leave failed projections retryable instead of faking success;
- who communicates downtime in the Kodaxa development guild.

Track A rollback must not delete evidence, reviews, audit rows, or outbox rows.

## Commands For The Track A Setup Review

These commands are evidence targets for the later setup review. Running commands
that mutate Railway services or variables requires a separate approval.

Read-only/local preparation:

```powershell
git status --short
git rev-parse HEAD
railway --version
railway status
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
pnpm check:lines
git diff --check
```

Database verification, only after the dedicated development `DATABASE_URL` is
selected and present without printing it:

```powershell
pnpm verify:migrations
```

Railway evidence, only after the reviewed service is linked:

```powershell
railway status
railway service status
railway service logs --lines 200
```

## Track A Evidence Checklist

- [ ] Railway project/service existence decided and recorded.
- [ ] Service root, build command, and start command reviewed.
- [ ] Runtime caveat for `tsx` start path accepted or separately corrected.
- [ ] Required executable runtime variables present without values printed.
- [ ] Shadow-style policy variables present without values printed.
- [ ] Development owner and credential revocation procedures recorded.
- [ ] Dedicated development database selected.
- [ ] Test-data retention/reset/cleanup disposition recorded.
- [ ] `pnpm verify:migrations` passes against the selected development DB.
- [ ] Hosted runtime DB connectivity proven.
- [ ] Private Kodaxa development ops queue verified by ID.
- [ ] Bot and mapped reviewer/override role access verified.
- [ ] Logs visible to operator.
- [ ] Restart/redeploy evidence captured.
- [ ] Rollback plan recorded before worker start.
- [ ] Hosted acceptance repeat completed.
- [ ] Follow-up acceptance record explicitly states the Track A decision.

## Decision

Phase 2.7 Track A evidence preparation: READY FOR REVIEW.

Track A persistent development shadow runtime remains blocked until this plan is
reviewed and a separate setup/acceptance pass records the required evidence.

Track B Agency-guild rollout readiness remains blocked until Track A passes.

## References

- Railway CLI:
  https://docs.railway.com/guides/cli
- Railway service commands:
  https://docs.railway.com/cli/service
- Railway variables:
  https://docs.railway.com/variables
- Railway monorepo deployment:
  https://docs.railway.com/guides/monorepo
- Railway healthchecks:
  https://docs.railway.com/reference/healthchecks
- Supabase database migrations:
  https://supabase.com/docs/guides/deployment/database-migrations
- Supabase backup and restore:
  https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore/
- Discord interactions and commands:
  https://docs.discord.com/developers/platform/interactions
- Discord interaction responses:
  https://docs.discord.com/developers/interactions/receiving-and-responding
- Discord permissions:
  https://docs.discord.com/developers/topics/permissions
