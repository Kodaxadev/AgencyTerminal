# Controls OAuth Operator Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock controls scaffold with a Discord OAuth-backed internal operator console.

**Architecture:** Add a small Node HTTP API beside the Vite app. Keep OAuth, sessions, Discord calls, database access, capability checks, and audit writes server-only; keep the React app API-backed and operational.

**Tech Stack:** Vite, React, TypeScript, Node HTTP, Drizzle/Postgres through `@agency-terminal/db`, Discord REST/OAuth APIs.

---

### Task 1: Shared Contracts And Auth Policy

**Files:**
- Create: `apps/controls/src/contracts.ts`
- Create: `apps/controls/server/auth/access.ts`
- Create: `apps/controls/server/__tests__/access.test.ts`

- [ ] Write tests for bootstrap capability grants, mapped-role grants, and page policy denial.
- [ ] Run `pnpm test:run apps/controls/server/__tests__/access.test.ts` and confirm failure.
- [ ] Implement shared capabilities, route requirements, and access helpers.
- [ ] Re-run the same test and confirm pass.

### Task 2: OAuth Session Core

**Files:**
- Create: `apps/controls/server/auth/session.ts`
- Create: `apps/controls/server/auth/oauth.ts`
- Create: `apps/controls/server/__tests__/session.test.ts`

- [ ] Write tests proving signed sessions reject tampering, expired sessions, and unknown session IDs.
- [ ] Run `pnpm test:run apps/controls/server/__tests__/session.test.ts` and confirm failure.
- [ ] Implement signed session cookies, process-local session storage, OAuth URL generation, and state validation.
- [ ] Re-run the same test and confirm pass.

### Task 3: HTTP Routing And Controls Repository

**Files:**
- Create: `apps/controls/server/http.ts`
- Create: `apps/controls/server/repository.ts`
- Create: `apps/controls/server/deployment.ts`
- Create: `apps/controls/server/index.ts`
- Create: `apps/controls/server/__tests__/deployment.test.ts`
- Modify: `apps/controls/package.json`
- Modify: `apps/controls/tsconfig.json`
- Modify: `apps/controls/vite.config.ts`

- [ ] Write tests proving deployment registration requires `REGISTER` and required env values.
- [ ] Run `pnpm test:run apps/controls/server/__tests__/deployment.test.ts` and confirm failure.
- [ ] Implement JSON routing, auth guards, config/roles/metrics/audit/health/deployment endpoints, and static file serving.
- [ ] Re-run the deployment test and a controls server typecheck.

### Task 4: Shared Discord Command Registration

**Files:**
- Create: `packages/discord-ui/src/slash-commands.ts`
- Modify: `packages/discord-ui/src/index.ts`
- Modify: `apps/bot/src/commands.ts`
- Modify: `apps/controls/package.json`

- [ ] Move command JSON and registration helper into `@agency-terminal/discord-ui`.
- [ ] Make the bot re-export the shared command helper.
- [ ] Let the controls server call the shared registration helper.
- [ ] Run bot and controls typecheck.

### Task 5: API-Backed Frontend

**Files:**
- Replace: `apps/controls/src/App.tsx`
- Create: `apps/controls/src/api.ts`
- Create: `apps/controls/src/layout.tsx`
- Create: `apps/controls/src/pages.tsx`
- Create: `apps/controls/src/styles.css`
- Modify: `apps/controls/src/main.tsx`

- [ ] Remove mock-only pages.
- [ ] Add login/status handling, overview, health, config, roles, audit, deployment, and read-only placeholder surfaces for later queues.
- [ ] Wire forms to API endpoints with typed confirmations.
- [ ] Build responsive, dense operator UI without secrets or public signup.

### Task 6: Verification

**Files:**
- All files touched above.

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm test:run`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm check:lines`.
- [ ] Run `pnpm audit --audit-level moderate`.
- [ ] Run `git diff --check`.
- [ ] Load `.env` locally without printing secrets and run `pnpm verify:migrations`.
- [ ] Start controls API and Vite dev server, then browser-check login/status and main controls routes.
