# Controls Governance Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the first leadership-ready controls surfaces: modular routes, retention policy controls, JSON exports, scoped queues, and table empty states.

**Architecture:** Keep controls as a server-owned operator console: browser calls typed API helpers, API routes enforce session capabilities, repository/service modules own database queries, and every state-changing action writes `audit_log`. New route modules prevent `apps/controls/server/http.ts` from growing beyond the 400-line rule while preserving the current no-new-dependency Node HTTP server.

**Tech Stack:** TypeScript, React/Vite, Vitest, Drizzle ORM, Supabase Postgres, Vercel Functions, Discord OAuth-backed controls sessions.

---

## Source Contracts

- Product and page scope: `docs/08_CONTROLS_PAGE.md`.
- Security and retention policy: `docs/09_SECURITY_PRIVACY_COUNTERINTEL.md`.
- Sprint ordering: `docs/16_COMPLETION_ROADMAP.md`.
- Current controls API seam: `apps/controls/server/http.ts`.
- Current controls repository seam: `apps/controls/server/repository.ts`.
- Current React page seam: `apps/controls/src/pages.tsx` and `apps/controls/src/settings-pages.tsx`.
- Current DB tables: `packages/db/schema/operations-tables.ts`, `packages/db/schema/evidence-tables.ts`, `packages/db/schema/ticket-tables.ts`.

## File Structure

- Create `apps/controls/server/routes/types.ts`: shared route context and protected route return type.
- Create `apps/controls/server/routes/retention.ts`: `/api/retention` GET/PATCH/POST dry-run/run routing.
- Create `apps/controls/server/routes/exports.ts`: `/api/exports` metadata and JSON export routing.
- Create `apps/controls/server/retention-service.ts`: retention defaults, validation, dry-run counts, run guard.
- Create `apps/controls/server/export-service.ts`: export metadata and redaction-safe JSON payload builders.
- Create `apps/controls/server/queue-scope.ts`: server-side scoped queue filters for evidence/tickets.
- Modify `apps/controls/server/http.ts`: delegate retention/export routes and keep auth/session flow unchanged.
- Modify `apps/controls/server/http-utils.ts`: preserve `adminChannelId` in config PATCH input.
- Modify `apps/controls/server/repository.ts`: expose retention/export/scoped-queue repository methods.
- Modify `apps/controls/server/auth/access.ts`: verify page access for `/evidence/intel`, `/contracts`, `/clearance`, `/retention`, `/exports`.
- Modify `apps/controls/src/contracts.ts`: add retention, export, and queue-scope DTOs.
- Modify `apps/controls/src/api.ts`: add retention/export/scoped queue client helpers.
- Modify `apps/controls/src/view-model.ts`: add navigation entries for new pages.
- Modify `apps/controls/src/App.tsx`: add routes for new pages.
- Modify `apps/controls/src/pages.tsx`: add empty states to existing queue/audit tables.
- Create `apps/controls/src/governance-pages.tsx`: Retention and Exports pages.
- Create `apps/controls/src/domain-pages.tsx`: Intel, Contracts, and Clearance queue pages.
- Add focused tests beside existing controls tests.

## Task 1: Route Seams And Config Regression

**Files:**
- Create: `apps/controls/server/routes/types.ts`
- Modify: `apps/controls/server/http.ts`
- Modify: `apps/controls/server/http-utils.ts`
- Test: `apps/controls/server/__tests__/http-utils.test.ts`

- [ ] **Step 1: Write the failing config regression test**

Add `apps/controls/server/__tests__/http-utils.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toConfigInput } from "../http-utils";

describe("controls http utils", () => {
  it("preserves admin channel ID in config PATCH input", () => {
    const input = toConfigInput({ adminChannelId: "admin-1", name: "Agency" }, {
      guildId: "guild-1",
      name: "Old Agency",
      staleReviewHours: 48,
    }, "guild-1");

    expect(input.adminChannelId).toBe("admin-1");
    expect(input.name).toBe("Agency");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm test:run apps/controls/server/__tests__/http-utils.test.ts`
Expected: FAIL because `adminChannelId` is currently dropped.

- [ ] **Step 3: Fix config input and add route context type**

Update `toConfigInput()` to include `adminChannelId: optionalString(body.adminChannelId)`.

Create `routes/types.ts` with:

```ts
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ControlsSession } from "../auth/session";
import type { ControlsHttpDependencies } from "../http";

export interface AuthContext {
  sessionId: string;
  session: ControlsSession;
}

export interface ProtectedRouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  deps: ControlsHttpDependencies;
  auth: AuthContext;
  guildId: string;
}
```

- [ ] **Step 4: Re-run the test**

Run: `pnpm test:run apps/controls/server/__tests__/http-utils.test.ts`
Expected: PASS.

## Task 2: Retention Service And Repository

**Files:**
- Create: `apps/controls/server/retention-service.ts`
- Modify: `apps/controls/server/repository.ts`
- Modify: `apps/controls/src/contracts.ts`
- Test: `apps/controls/server/__tests__/retention-service.test.ts`

- [ ] **Step 1: Write retention service tests**

Add tests proving:
- default policy classes include all values from `retention_class`;
- score/audit classes are marked protected from destructive runs;
- `validateRetentionPolicyInput()` rejects negative retain days;
- `buildRetentionRunReport()` requires a previous dry-run token for run mode.

Run: `pnpm test:run apps/controls/server/__tests__/retention-service.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 2: Add DTO contracts**

Add `RetentionPolicyDto`, `RetentionDryRunDto`, `RetentionRunDto`, and `RetentionPolicyInput` to `apps/controls/src/contracts.ts`.

- [ ] **Step 3: Implement service helpers**

Implement pure helpers in `retention-service.ts`:
- `RETENTION_CLASSES`
- `PROTECTED_RETENTION_CLASSES`
- `normalizeRetentionPolicyInput(input)`
- `buildRetentionDryRun(rows, now)`
- `buildRetentionRunReport(input)`

No database writes belong in this file.

- [ ] **Step 4: Add repository methods**

Add repository methods:
- `listRetentionPolicies(guildId)`
- `saveRetentionPolicy(input, actorDiscordId)`
- `dryRunRetention(guildId)`
- `runRetention(guildId, confirmation, actorDiscordId)`

The first run implementation may report eligible counts and write audit only; it must not delete/redact rows until Sprint 7 storage/retention execution is built.

- [ ] **Step 5: Re-run retention tests**

Run: `pnpm test:run apps/controls/server/__tests__/retention-service.test.ts`
Expected: PASS.

## Task 3: Export Service And Audit Safety

**Files:**
- Create: `apps/controls/server/export-service.ts`
- Create: `apps/controls/server/routes/exports.ts`
- Modify: `apps/controls/server/repository.ts`
- Modify: `apps/controls/src/contracts.ts`
- Test: `apps/controls/server/__tests__/export-service.test.ts`

- [ ] **Step 1: Write export service tests**

Add tests proving:
- available export types are `ledger`, `agents`, `audit`, `tickets`, and `retention`;
- audit export requires confirmation `EXPORT`;
- full ledger export requires confirmation `EXPORT`;
- export metadata includes `guildId`, `generatedAt`, `sensitivity`, and `recordCount`.

Run: `pnpm test:run apps/controls/server/__tests__/export-service.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 2: Add export DTOs**

Add `ExportType`, `ExportDescriptorDto`, `ExportPayloadDto`, and `ExportRequestDto`.

- [ ] **Step 3: Implement export builders**

Implement pure helpers:
- `listExportDescriptors()`
- `requireExportConfirmation(type, confirmation)`
- `buildExportPayload(type, guildId, rows, generatedAt)`

- [ ] **Step 4: Add repository export methods**

Add repository method `buildExport(type, guildId, actorDiscordId, confirmation)` that reads only guild-scoped rows and writes an audit event for every successful export.

- [ ] **Step 5: Re-run export tests**

Run: `pnpm test:run apps/controls/server/__tests__/export-service.test.ts`
Expected: PASS.

## Task 4: Protected Retention And Export Routes

**Files:**
- Create: `apps/controls/server/routes/retention.ts`
- Create: `apps/controls/server/routes/exports.ts`
- Modify: `apps/controls/server/http.ts`
- Test: `apps/controls/server/__tests__/retention-routes.test.ts`
- Test: `apps/controls/server/__tests__/export-routes.test.ts`

- [ ] **Step 1: Write route tests**

Tests should call route handlers with mocked repositories and assert:
- `/api/retention` requires `can_manage_config`;
- policy save requires confirmation `RETENTION`;
- run requires confirmation `RETENTION`;
- `/api/exports` requires `can_manage_config`;
- export download requires confirmation `EXPORT` for audit and ledger.

Run: `pnpm test:run apps/controls/server/__tests__/retention-routes.test.ts apps/controls/server/__tests__/export-routes.test.ts`
Expected: FAIL because routes do not exist.

- [ ] **Step 2: Implement route modules**

`handleRetentionRoute(context)` handles:
- `GET /api/retention`
- `PATCH /api/retention/:class`
- `POST /api/retention/dry-run`
- `POST /api/retention/run`

`handleExportsRoute(context)` handles:
- `GET /api/exports`
- `POST /api/exports/:type`

- [ ] **Step 3: Delegate from `http.ts`**

Before the deployment route branch, add delegation for paths starting with `/api/retention` and `/api/exports`.

- [ ] **Step 4: Re-run route tests**

Run: `pnpm test:run apps/controls/server/__tests__/retention-routes.test.ts apps/controls/server/__tests__/export-routes.test.ts`
Expected: PASS.

## Task 5: Scoped Queues

**Files:**
- Create: `apps/controls/server/queue-scope.ts`
- Modify: `apps/controls/server/repository.ts`
- Modify: `apps/controls/server/http.ts`
- Modify: `apps/controls/server/auth/access.ts`
- Modify: `apps/controls/src/contracts.ts`
- Test: `apps/controls/server/__tests__/queue-scope.test.ts`

- [ ] **Step 1: Write scoped queue tests**

Tests should prove:
- intel queue requires `can_manage_intel`;
- contract queue requires `can_manage_contracts`;
- clearance queue requires `can_manage_clearance`;
- handler queue excludes `director_only` records unless the session has a sensitive-view capability.

Run: `pnpm test:run apps/controls/server/__tests__/queue-scope.test.ts`
Expected: FAIL because scope helpers do not exist.

- [ ] **Step 2: Implement scope helpers**

Implement `getQueueScope(pathname, capabilities)` and `canViewSensitivity(sensitivity, capabilities)`.

- [ ] **Step 3: Add repository methods**

Add:
- `listIntelEvidence(guildId, capabilities)`
- `listContractTickets(guildId, capabilities)`
- `listClearanceTickets(guildId, capabilities)`

- [ ] **Step 4: Add API routes**

Add protected routes for:
- `GET /api/evidence/intel`
- `GET /api/contracts`
- `GET /api/clearance`

- [ ] **Step 5: Re-run scoped queue tests**

Run: `pnpm test:run apps/controls/server/__tests__/queue-scope.test.ts`
Expected: PASS.

## Task 6: React Pages And Empty States

**Files:**
- Create: `apps/controls/src/governance-pages.tsx`
- Create: `apps/controls/src/domain-pages.tsx`
- Modify: `apps/controls/src/api.ts`
- Modify: `apps/controls/src/view-model.ts`
- Modify: `apps/controls/src/App.tsx`
- Modify: `apps/controls/src/pages.tsx`
- Test: `apps/controls/src/__tests__/view-model.test.ts`

- [ ] **Step 1: Extend navigation tests**

Update tests so:
- `can_manage_config` sees `/retention` and `/exports`;
- `can_manage_intel` sees `/evidence/intel`;
- `can_manage_contracts` sees `/contracts`;
- `can_manage_clearance` sees `/clearance`.

Run: `pnpm test:run apps/controls/src/__tests__/view-model.test.ts`
Expected: FAIL until navigation is updated.

- [ ] **Step 2: Add API helpers**

Add client helpers for retention, exports, intel evidence, contract tickets, and clearance tickets.

- [ ] **Step 3: Add pages**

Implement:
- `RetentionPage`
- `ExportsPage`
- `IntelEvidencePage`
- `ContractsPage`
- `ClearancePage`

Use current table/panel styling and visible empty-state rows for zero records.

- [ ] **Step 4: Add routes**

Add React routes for `/retention`, `/exports`, `/evidence/intel`, `/contracts`, and `/clearance`.

- [ ] **Step 5: Re-run navigation tests**

Run: `pnpm test:run apps/controls/src/__tests__/view-model.test.ts`
Expected: PASS.

## Task 7: Verification And Commit

**Files:**
- All files touched above.

- [ ] **Step 1: Run focused tests**

Run the new and modified controls tests.
Expected: PASS.

- [ ] **Step 2: Run full local gate**

Run:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:run`
- `pnpm build`
- `pnpm check:lines`
- `pnpm verify:migrations`
- `git diff --check`

Expected: PASS.

- [ ] **Step 3: Review file lengths**

If `http.ts`, `repository.ts`, `pages.tsx`, or any new file approaches 400 lines, split before commit.

- [ ] **Step 4: Commit**

Commit message: `feat: add controls governance surfaces`.

## Self-Review

- Spec coverage: maps to Sprint 1 in `docs/16_COMPLETION_ROADMAP.md`.
- Placeholder scan: no open-ended placeholders are present.
- Type consistency: DTOs are introduced before API and UI consumers.
- Scope risk: destructive retention execution is intentionally limited to report/audit in this sprint; actual delete/redact belongs to Sprint 7.
