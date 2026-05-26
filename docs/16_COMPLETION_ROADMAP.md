# Agency Terminal Completion Roadmap

> Last updated: 2026-05-26.

## Purpose

This roadmap turns the remaining Agency Terminal work into sprint-sized,
testable slices. It supersedes the phase-only view in
`docs/11_IMPLEMENTATION_ROADMAP.md` for day-to-day execution, but it does not
replace the PRD, ADRs, or security policy.

## Current Baseline

- Product direction: Agency Terminal makes Discord-native contribution and
  workflow history legible without deciding human worth. Source:
  `README.md`, `docs/01_PRD.md`.
- Canonical data model: Discord is the workflow UI and Postgres is the source
  of truth. Source: `docs/02_ARCHITECTURE.md`,
  `docs/adrs/ADR-003-discord-ui-postgres-source.md`.
- Authority policy: v1 must not automatically grant, remove, promote, demote,
  ban, or kick Discord roles. Source:
  `docs/adrs/ADR-011-no-automatic-authority-mutation.md`,
  `docs/09_SECURITY_PRIVACY_COUNTERINTEL.md`.
- Launch policy: shadow mode cannot graduate until appeals, score reversal,
  profile split, and retention/export policy exist. Source:
  `docs/03_HOSTING_ARCHITECTURE.md`,
  `docs/adrs/ADR-013-appeals-before-authority.md`,
  `docs/adrs/ADR-014-shadow-mode-first.md`.
- Controls baseline: Discord OAuth, dual-guild access, config, roles, metrics,
  evidence, tickets, audit, deployment, health, and outbox visibility exist.
  Source: `apps/controls/server/http.ts`, `apps/controls/src/view-model.ts`.
- Bot baseline: `/evidence submit`, `/evidence status`, `/ticket ...`, and
  `/director override` exist; most domain workflow actions are still skeletal.
  Source: `packages/discord-ui/src/slash-commands.ts`,
  `apps/bot/src/handlers.ts`.
- Hosting baseline: controls are on Vercel and the bot runs as a Railway
  persistent service. Railway documents persistent services as always-running
  deployment targets, and stores variables, source refs, build commands, and
  start commands per service: https://docs.railway.com/develop/services.

## Execution Rules

- One sprint should end in deployable, reversible software.
- Every database-affecting change gets a migration, a Drizzle schema update,
  and migration verification.
- Every controls action that changes state writes `audit_log`.
- Every destructive or authority-adjacent action requires server-side
  capability checks and explicit confirmation.
- Score and authority features remain shadow/advisory until appeals, exports,
  and retention are complete.
- Dual-guild behavior stays explicit: Kodaxa dev is for development access,
  Agency is for leader-controlled launch access.
- No new dependency is allowed without a source-backed reason and a smaller
  alternative considered.

## Evidence And Platform Decisions

| Decision | Reason | Source |
|---|---|---|
| Keep the bot on Railway, not Vercel functions | Discord gateway bots need a persistent process; Railway persistent services are meant to stay running and retain deployment logs/metrics | `docs/03_HOSTING_ARCHITECTURE.md`; https://docs.railway.com/develop/services |
| Keep controls on Vercel | The controls site is HTTP request/response UI, and Vercel supports production deploys, env vars, and custom domains | `vercel.json`; https://vercel.com/docs/environment-variables; https://vercel.com/docs/projects/domains/add-a-domain |
| Keep Supabase transaction pooler with prepared statements disabled for serverless controls | Supabase documents transaction mode for transient/serverless traffic and says transaction mode does not support prepared statements; it also gives the Drizzle/Postgres.js `prepare: false` pattern | `packages/db/src/client.ts`; https://supabase.com/docs/guides/database/connecting-to-postgres; https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL |
| Keep Guild Members intent opt-in | Discord treats member access as a privileged gateway intent that must be enabled in the Developer Portal | `apps/bot/src/intents.ts`; https://docs.discord.com/developers/topics/gateway |
| Keep bot install and command registration separate from controls login | Discord OAuth bot/application command scopes install the app, while controls login needs user OAuth/session authorization | `apps/controls/server/auth/oauth.ts`; https://docs.discord.com/developers/topics/oauth2; https://docs.discord.com/developers/platform/oauth2-and-permissions |

## Sprint 0 - Roadmap And Release Discipline

Goal: make remaining work explicit, sequenced, and reviewable.

Actions:
- Add this roadmap.
- Keep `docs/11_IMPLEMENTATION_ROADMAP.md` as historical phase context.
- Treat future feature work as sprint branches or compact checkpoint commits.
- Use the standard gates after each sprint:
  `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm build`,
  `pnpm check:lines`, `pnpm verify:migrations`, `git diff --check`.

Done when:
- The roadmap is committed and pushed.
- The next sprint has a concrete implementation plan before source edits.

## Sprint 1 - Controls Governance Surface

Goal: finish the operator console surfaces that leadership needs before wider
bot behavior expands.

Build:
- `/retention` page and `/api/retention` endpoints for policy list/edit,
  dry-run, and run confirmation.
- `/exports` page and `/api/exports` endpoints for JSON ledger, audit, ticket,
  agent, and retention-report exports.
- `/evidence/intel`, `/contracts`, and `/clearance` filtered queue pages.
- Empty states and clearer table behavior for all queue/table views.
- Server-side dataset filters for recruiter, intel, contract, handler, and
  director scopes.

Systems:
- Controls API route modules should be split by responsibility instead of
  growing `apps/controls/server/http.ts`.
- Export builders must redact by capability and sensitivity.
- Retention run must support dry-run first, explicit confirmation, audit log,
  and no deletion of score/audit history.

Tests:
- Access-policy tests for every new page.
- Repository tests for retention/export DTOs.
- UI view-model tests for new navigation.
- End-to-end smoke on `https://atcc.kodaxa.dev` after deployment.

## Sprint 2 - Workflow Engine Completion

Goal: make ticket workflows real state machines instead of basic ticket shells.

Build:
- Workflow transition service for enlistment, contract, intel, clearance,
  doctrine, and general tickets.
- Domain detail writers for `contract_details`, `clearance_requests`, and
  `doctrine_challenges`.
- Bot commands/buttons/modals for common transitions:
  receive, validate, approve, reject, archive, export, and escalate.
- Controls repair actions for missing Discord channel projection and forced
  archive.

Systems:
- Persist workflow events for every transition.
- Keep Discord channels as projections, never canonical state.
- Use idempotency keys for interaction-driven transitions.

Tests:
- State transition matrix tests.
- Bot handler permission tests.
- Outbox projection tests for channel updates.

## Sprint 3 - Evidence Operations

Goal: make evidence submission, review, stale handling, and manual operations
complete enough for shadow-mode use.

Build:
- `/evidence status` backed by database lookup.
- Manual backfill flow gated by `can_backfill_evidence`.
- More evidence, duplicate, reject, and stale-escalate actions from controls.
- Group credit and witness management flows.
- Quality tier capture during review.

Systems:
- Backfill records must mark submitted mode, backfill reason, and actor.
- Review conflict disclosure remains required.
- Score credit must stay idempotent and append-only.

Tests:
- Backfill validation tests.
- Group credit scoring tests.
- Controls action audit tests.

## Sprint 4 - Profiles And Score Authority

Goal: expose useful score/profile views without making scores authority-bearing.

Build:
- `/profile @agent` public/member-safe view.
- `/profile @agent --full` officer/director view.
- Controls agent profile detail.
- Score reversal command/action gated by `can_reverse_score`.
- Score correction path for mistaken reversals.

Systems:
- Public score never goes negative.
- Officer-only metric visibility stays hidden from public/member views.
- Reversal and correction records are append-only.

Tests:
- Metric visibility tests.
- Negative-public-score prevention tests.
- Reversal/correction audit tests.

## Sprint 5 - Appeals

Goal: satisfy the appeals-before-authority requirement.

Build:
- `/evidence appeal` command.
- Appeals queue in controls.
- Appeal review actions: under review, granted, denied, final.
- Final appeal protection with director override path.

Systems:
- Only submitter, credited subject, officer, or director can appeal.
- Every appeal state change writes `audit_log`.
- Granted appeals must trigger the appropriate evidence/score correction path.

Tests:
- Appeal eligibility tests.
- Appeal transition tests.
- Controls appeals access tests.

## Sprint 6 - Domain Workflow Depth

Goal: make each Agency workflow useful to its actual operator role.

Build:
- Enlistment intake fields and recruiter queue.
- Contract intake fields, payment/terms sensitivity, and contract officer queue.
- Intel confidence/sensitivity/source fields and intel officer queue.
- Clearance request evidence linkage and director recommendation output.
- Doctrine challenge archive/adoption workflow.

Systems:
- Recruiters cannot see intel records.
- Intel officers cannot see contract terms unless separately authorized.
- Director can see all records.

Tests:
- Dataset scoping tests by capability.
- Sensitive field redaction tests.
- Workflow-specific happy-path bot tests.

## Sprint 7 - Retention, Archives, And Storage

Goal: make data lifecycle credible before real Agency rollout.

Build:
- Supabase Storage archive adapter for transcripts/evidence copies.
- Ticket transcript generation.
- Retention job executor with dry-run report, run report, and audit log.
- Export metadata with sensitivity labels.

Systems:
- Retention jobs must be resumable or safely retryable.
- Score and audit records are not normally deleted.
- Sensitive exports require explicit confirmation and audit trail.

Tests:
- Retention dry-run/run tests.
- Export redaction tests.
- Storage adapter contract tests.

## Sprint 8 - Observability And Repair

Goal: make failures visible and repairable without developer-only access.

Build:
- Health checks for bot guild read, audit channel post, ops queue post,
  migrations, command registration, and worker freshness.
- Outbox retry/dead-letter inspection and repair controls.
- Deployment actions for command registration per selected guild.
- Operator runbook updates for Vercel, Railway, Supabase, and Discord.

Systems:
- Repair actions require `can_manage_config`.
- Dead-letter replay must be explicit and audited.
- Health should distinguish missing config, Discord permission failure, and DB
  failure.

Tests:
- Health status tests.
- Dead-letter replay tests.
- Deployment action confirmation tests.

## Sprint 9 - Agency Rollout Path

Goal: move from Kodaxa dev validation to Agency leader-controlled launch.

Build:
- Agency guild bootstrap checklist.
- Agency role mapping checklist.
- Bot install verification for Agency server.
- Per-guild command registration from controls.
- Shadow-mode launch report.

Systems:
- Dev bootstrap user must not grant Agency authority.
- Agency leader can operate Agency controls without developer Discord powers.
- Any switch from dev guild to Agency guild must be visible in UI and audit.

Tests:
- Dual-guild auth tests.
- Agency guild command registration smoke.
- Controls live smoke with leader-access path when available.

## Sprint 10 - Launch Hardening

Goal: decide whether the project is ready for Agency shadow-mode use.

Build:
- Final threat-model pass.
- Accessibility and responsive UI pass.
- Full smoke script/runbook.
- Release notes and known-limits document.
- Backup/restore rehearsal notes.

Systems:
- No critical schema changes pending.
- Appeals, reversal, retention, and export are complete.
- Leadership has accepted the social contract.

Tests:
- Full verification gate.
- Live controls smoke.
- Railway bot heartbeat check.
- Discord slash-command smoke in dev, then Agency.

## Cross-Sprint Backlog

- Add pagination/filtering before large tables become slow.
- Add rate limits to dangerous controls actions.
- Add audit export integrity metadata.
- Add repair tooling for stuck sessions and stale OAuth role snapshots.
- Add CI once the local gate is consistently green.
- Add Sentry or equivalent only after Railway/Vercel logs stop being enough.
- Revisit session vs transaction pooler split if controls traffic or bot DB
  usage changes materially.

## Risk Register

| Risk | Mitigation |
|---|---|
| Score disputes dominate usage | Keep score shadow/advisory until appeals and correction paths are proven |
| Developer accidentally receives Agency authority | Keep dual-guild bootstrap split and test Agency guild isolation |
| Sensitive intel/contract data leaks | Server-side dataset filters and export redaction before richer domain queues |
| Retention deletes canonical history | Dry-run first, explicit confirmation, audit log, and no normal score/audit deletion |
| Discord permissions drift | Health checks for channel read/post and ops queue access |
| Railway bot silently stops | Worker heartbeat, Railway service status, restart policy, and health surface |
| Supabase pooler mismatch breaks runtime | Keep `prepare: false`, use transaction pooler for Vercel, and re-evaluate pool mode before long-lived DB sessions grow |

## Next Implementation Plan

The next code plan should be Sprint 1: Controls Governance Surface. It should
split controls routing into focused modules before adding retention/export
routes so `apps/controls/server/http.ts` does not become the operational
monolith.
