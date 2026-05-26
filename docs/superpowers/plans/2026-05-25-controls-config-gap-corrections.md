# Controls Config Gap Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the controls panel affect bot scoring/configuration and expose the operational health gaps found in the audit.

**Architecture:** Keep the database schema as the shared contract, with small DB helper modules consumed by bot code and controls repository code. The controls UI should only render fields and counts already backed by server DTOs; the bot should use configuration with conservative fallbacks when rows are absent.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL/Supabase, Vitest, React/Vite controls app, Vercel deployment.

---

## Files And Responsibilities

- `packages/db/schema/ticket-tables.ts`: Add `guild_config.admin_channel_id`.
- `packages/db/src/metric-config.ts`: Fetch latest enabled/disabled metric config for a guild/category.
- `packages/db/src/worker-heartbeats.ts`: Upsert worker heartbeat rows.
- `packages/db/src/index.ts`: Export new DB helpers.
- `packages/db/migrations/009_controls_config_gap_corrections.sql`: Persist the admin channel column.
- `apps/bot/src/scoring.ts`: Use DB metric config instead of hardcoded scoring constants.
- `apps/bot/src/outbox-processor.ts`: Record heartbeat after each outbox/stale-review processing pass.
- `apps/bot/src/handlers.ts`: Gate active ticket subcommands with existing capabilities.
- `apps/controls/server/repository.ts`: Map admin channel, worker heartbeat, and outbox counts into DTOs.
- `apps/controls/src/contracts.ts`: Add admin channel and outbox/health DTO fields.
- `apps/controls/src/settings-pages.tsx`: Add admin channel field.
- `apps/controls/src/pages.tsx`: Show pending/dead outbox visibility on Overview/Health.
- Tests under existing `__tests__` folders: Prove each behavior before implementation.

## Task 1: Metric Config Scoring

- [ ] Write a failing bot scoring test where category config returns `basePoints: 25`, `version: 3`, and the audit/scoring path uses those values.
- [ ] Write a failing bot scoring test where the latest metric config is disabled and no credit/follow-up is produced.
- [ ] Implement `packages/db/src/metric-config.ts` with a latest-version Drizzle select.
- [ ] Update `apps/bot/src/scoring.ts` to use the helper with fallback `{ basePoints: 10, enabled: true, version: 1 }`.
- [ ] Run the targeted scoring test and confirm it passes.

## Task 2: Admin Channel Config

- [ ] Write failing controls repository/contract coverage for saving and reading `adminChannelId`.
- [ ] Add the migration and Drizzle column.
- [ ] Update server DTO mapping and save logic.
- [ ] Update the Config page form field.
- [ ] Run targeted controls tests and typecheck.

## Task 3: Worker And Outbox Visibility

- [ ] Write failing repository tests for `outboxPending`, `outboxDead`, and worker heartbeat health rows.
- [ ] Implement a worker heartbeat helper with an upsert keyed by worker/guild.
- [ ] Record heartbeat from the outbox processor after a processing pass.
- [ ] Update Overview and Health DTOs/UI to display pending/dead outbox status and worker heartbeat age.
- [ ] Run targeted controls tests and bot tests.

## Task 4: Capability Gating

- [ ] Write failing handler tests for denied `/ticket enlistment`, `/ticket contract`, `/ticket intel`, and `/ticket clearance` when the user lacks the matching capability.
- [ ] Add a small mapping helper from subcommand to required capability.
- [ ] Keep existing review/override checks intact.
- [ ] Run targeted handler tests.

## Task 5: Guarded Operational Items

- [ ] Expose `AGENCY_ALLOW_OPS_QUEUE_SETUP` as read-only deployment/health policy, not a production write toggle.
- [ ] Add a clear health warning if `GuildMembers` is not enabled/configured, without adding the privileged intent by default.
- [ ] Document why these are guarded and what the Agency leader must enable for future join automation.

## Task 6: Verification And Deployment

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test:run`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm check:lines`.
- [ ] Run `pnpm audit --audit-level moderate`.
- [ ] Run `git diff --check`.
- [ ] Deploy with `vercel --prod --yes`.
- [ ] Smoke check `https://atcc.kodaxa.dev/`, `/overview`, `/health`, `/config`, and Vercel error logs.

## Self-Review Notes

- The plan deliberately does not add a production web toggle for ops-queue self-setup because current bot code and docs treat that switch as development-only.
- The plan deliberately does not enable `GuildMembers` by default because Discord member events require a privileged intent and the current bot has no join-event automation handler.
- Retention policy page work is left out of this slice because it is a larger planned feature, not a confirmed defect in the current live controls loop.
