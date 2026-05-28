# Agency Workflow Console — TicketTool Replacement Pivot and Dual-Hosting Completion Plan

**Status:** Design / replanning pass. Docs-only. Drafted on `design/agency-workflow-console-pivot`.
**Baseline commit:** `a923ea0` (merge of PR #10, `design/ticket-lifecycle`).
**Companion ADR:** [`docs/adrs/ADR-018-agency-workflow-console-and-dual-hosting.md`](./adrs/ADR-018-agency-workflow-console-and-dual-hosting.md).
**Relationship to prior docs:** Extends, does not rewrite, [`docs/16_COMPLETION_ROADMAP.md`](./16_COMPLETION_ROADMAP.md). Re-sequences its sprint order; the amendment note is in §14. Does not amend `docs/05`, the schema, or any ADR text. Reaffirms ADR-001 (single-guild-first), ADR-008 (not-SaaS), ADR-011 (no automatic authority mutation).

> This is a planning document. No application code, schema, migration, env, permission, deployment, or Discord-activation change is authorized by it. Implementation begins only after Justin reviews this draft.

---

## 1. Executive decision

The first deployable, customer-facing product is **not** "activate the existing operations bot in a recruitment server." It is:

**Agency Workflow Console** — a tribe-owned **TicketTool replacement** built on the existing AgencyTerminal platform, delivered as two surfaces that share one foundation:

1. **Agency Intake (TicketTool replacement)** — *first customer-facing product.*
   Public recruitment server. Panels → pre-ticket forms → private tickets. **Application** flow first; **Diplomacy** and **Contracts** follow on the same configurable engine. Logging, transcripts, claiming, automation added progressively.

2. **Agency Terminal Operations** — *later / private surface.*
   The already-built evidence, intel, clearance, governance, and audit workflows. Not discarded; re-homed as a private operations surface that reuses the same core (DB, outbox, controls, lifecycle engine) rather than being the recruitment-server product.

The merged ticket-lifecycle engine work (ADR-017, `docs/17`) remains valid as a **backend foundation**. What changes is its first *visible UX*: button/modal/private-ticket driven, not routine slash commands (§13).

---

## 2. Validated external findings

A real external Agency leader tested the public ATCC bot-install link. Observed, verbatim in effect:

- **Install worked.** The bot joined the Agency Discord server and appeared under Integrations.
- **Configuration path is missing.** The leader's immediate question was "how tf do I configure it?" — there is no guided activation/onboarding surface for a freshly-joined guild.
- **Slash commands did not activate** in the external guild. Root cause confirmed in code (§3): command registration is hard-bound to a single configured `DISCORD_GUILD_ID`, and the outbox worker loop is bound to the same single guild. A newly-joined guild is never registered against the running worker.
- **Permission posture was operations-oriented and broad.** The install URL is built from `DISCORD_BOT_PERMISSIONS` (`apps/controls/server/deployment.ts`); whatever integer is configured is what the Agency granted. This posture was designed for a trusted single operations guild, not for a recruitment-server pilot that should request the **minimum** permissions to run intake (§9).

Product-discovery conclusion: the customer's actual first need is a **recruitment intake / ticket workflow**, replacing the paid TicketTool subset they currently use.

### 2.1 Current recruitment-server flow (to integrate with, not replace wholesale)

1. A **separate existing onboarding/verification bot** already handles: onboarding protocol post, VPN warning, Double Counter verification, rules acknowledgement, and unlocking `#reception`. **Preserve this initially** (§4).
2. In `#reception`, **TicketTool** currently offers buttons: **Application**, **Diplomacy**, **Contracts**.
3. **Application** creates a private interview ticket/channel.
4. Current interview questions (five, verbatim — §5.2).
5. Leader-defined recruitment outcome: stages **Application → Interview → Accepted / Declined**; accepted applicants ideally receive a temporary invite to the private Agency server; declined applications are archived.
6. The leader does **not** want a slash-command recruitment flow. Normal UX must be automatic / button / modal / private-ticket driven.
7. The leader uses only a limited free TicketTool subset to avoid the fee, and would adopt more paid-tier capabilities — especially **logging** and supporting workflow features — if their own bot provided them.

A captured TicketTool feature reference exists as research input. Treat its categories as **competitor/replacement inventory**, not a mandate to implement every generic feature immediately. High-value categories: configurable panels; pre-ticket forms (≤5 questions); open/closed/archive/overflow categories; permission routing by roles; ticket messages/buttons; logging; transcripts; ticket limits & duplicate protection; claiming; automation; configuration/dashboard tooling.

---

## 3. Current repo inventory

Baseline inspected directly (not trusted from summary). Branch at time of writing: `feature/ticket-transition-engine`; HEAD = `main` = `origin/main` = `a923ea0`. (Uncommitted ticket-transition-engine WIP exists in the working tree — see §13 and the recon report; it does not conflict with this docs-only pivot.)

### 3.1 Reusable as-is (high value for Agency Intake)

| Component | Location | Why it transfers |
|---|---|---|
| **Button → modal → action interaction pipeline** | `apps/bot/src/handlers.ts` (`handleInteraction` routes `isButton`/`isModalSubmit`; `handleButton` parses `customId` `action:type:id`; builds `ModalBuilder` with `TextInputBuilder` fields; `handleModalSubmit` routes by `customId` prefix) | This *is* the panel/button/modal foundation. The evidence-review flow already proves publish-button → open-modal → submit → act. Application intake is the same shape. |
| **Private channel provisioning with permission overwrites** | `apps/bot/src/outbox-processor.ts` `handleTicketCreatedOutbox` (`guild.channels.create` with `buildDenyEveryoneOverwrite(@everyone)` + `allowCreator(creatorId)`, topic marker, idempotent reconcile via `findExistingTicketChannel`) | Exactly the private-interview-channel mechanic. Needs a staff-role allow overwrite added (§6). |
| **Deterministic in-channel markers + at-most-once projection** | `apps/bot/src/safety.ts` (`getTicketChannelMarker`, `getStaleAlertMarker`, `getTicketTransitionMarker`) | Reusable idempotency mechanic for posting panel messages, transition messages, transcripts once. |
| **Outbox worker (claim/backoff/dead-letter)** | `packages/db/src/outbox.ts` (`enqueueOutbox`, `claimDueOutbox` FOR UPDATE SKIP LOCKED, `markOutboxFailed` exponential backoff, dead-letter), dispatch loop in `outbox-processor.ts` | All async Discord side effects (channel create, panel publish, transcript post, invite create) ride this. |
| **Ticket lifecycle engine concepts** | `docs/17`, ADR-017; `packages/db/src/lifecycle.ts` (pure `lifecycleFor`, `canTransitionWorkflow`, declarative per-workflow matrix) | The Application → Interview → Accepted/Declined → Archived lifecycle reuses the **existing `enlistment` workflow type** on this engine (§5.5) — no new workflow type. Engine reused; the *driver* becomes buttons, not slash commands. |
| **Per-guild config + role→capability mapping** | `packages/db/schema/ticket-tables.ts` `guild_config` (admin/audit/ops-queue/archive channel IDs, stale hours) and `role_mappings` (capability → discord_role_id, unique per guild) | Foundation for staff-role routing and per-guild settings. Lacks panel/form/category config (§6). |
| **Idempotency keys** | `packages/db/src/idempotency.ts` (`claimIdempotencyKey`/`completeIdempotencyKey`, scoped) | Interaction-driven ticket creation and lifecycle moves are already idempotent. |
| **Audit log** | `writeAuditLog`, `audit_log` table | Every state change auditable; satisfies logging requirements (§5.5). |
| **ATCC controls platform** | `apps/controls/*` (OAuth operator login, config/roles/metrics/evidence/tickets/audit/deployment/health/outbox surfaces, capability-gated server routes, redaction) | The configuration/dashboard surface for Hosting Model A. |
| **ATCC deployment surface (activation skeleton)** | `apps/controls/server/deployment.ts` (`buildBotInviteUrl(clientId, permissions)`, `register_commands` action that **accepts a `guildId` parameter** with confirmation gate) | Already most of the "install + register-to-this-guild" activation path. Needs to register to the *joined* guild and capture per-guild activation state (§3.3, §7). |

### 3.2 Implemented functions worth naming

- `createTicket(input, idempotencyKey)` — transactional ticket + participants + `workflow_instances` + `ticket_events` + outbox enqueue, idempotent. Fields already include `tribeName`, `characterName`, `walletAddress`, etc. — a superset of recruitment form fields.
- `transitionTicket` / `repairTicket` (WIP on `feature/ticket-transition-engine`) — lifecycle moves for `general`/`enlistment` with audit/outbox/idempotency. Reusable internally; UX re-fronted (§13).
- `getCapabilitiesForRoles` / `getRoleIdsForCapabilities` — staff routing primitives.
- `registerCommands(clientId, guildId, token)` — guild-scoped command PUT (single-guild today, §3.3).
- `handleTicketCreatedOutbox`, `resolveOpsQueueChannel`, stale-alert projection — channel + projection plumbing.

### 3.3 What hard-codes operations / single-guild assumptions

| Assumption | Location | Impact on pivot |
|---|---|---|
| **Single `DISCORD_GUILD_ID`** for command registration | `apps/bot/src/index.ts` (`registerCommands(..., DISCORD_GUILD_ID, ...)` on `ready`) | New guilds never get commands. (For recruitment we favor buttons over commands anyway, but activation must register to the *joined* guild.) |
| **Outbox loop bound to one guild** | `apps/bot/src/index.ts` `startOutboxLoop({ guildId: DISCORD_GUILD_ID })`; `processOutbox(client, guildId)` scans/heartbeats per that guild | Fine for the single-guild pilot (both Model A pilot and Model B). Not a blocker for the first Application replacement. |
| **Required env is single-tenant** | `apps/bot/src/index.ts` requires `DISCORD_GUILD_ID`; `validateEnv` exits without it | Single-guild is the intended pilot shape (ADR-001). Not changed for the pilot. |
| **Permission integer is global** | `DISCORD_BOT_PERMISSIONS` env → `buildBotInviteUrl` | One global posture; recruitment install should be minimal (§9). |
| **Channel creation lacks staff-role overwrite** | `handleTicketCreatedOutbox` allows only `@everyone`-deny + creator-allow | Interview channels must also grant the recruiter/interviewer staff role (§6). |
| **Operations vocabulary in command tree** | `slash-commands.ts` (`evidence`, `clearance`, `intel`, `director override`) | Unsuitable to expose in a recruitment guild as-is; recruitment surface should be button-driven and not register operations commands there. |
| **Hosting recipe is Railway+Supabase-specific** | `railway.toml`, `docs/16` decisions, `client.ts` Supabase pooler notes | Model B must not require Railway/Supabase (§8). |

### 3.4 What does not exist yet (must be designed/built)

- **Panel configuration model** (a published reception message with buttons). No table, no publish path, no stored message/button IDs.
- **Pre-ticket form/question model** (≤5 configurable questions per panel/type). Modals are built ad-hoc in code today; nothing is config-driven.
- **Ticket category / overflow / archive routing config** (Discord category IDs for open/closed/archive, overflow on category-full).
- **Staff/additional role access config per panel** (beyond the global `role_mappings` capability map).
- **Ticket limits & duplicate protection** (per-user open-ticket caps, "you already have an open application").
- **Claiming / assignment** (`tickets.assignedDiscordId` column exists but no claim flow).
- **Transcripts** (generation, storage adapter, posting).
- **Automation** (auto-close on inactivity, auto-archive, scheduled prompts).
- **Temporary-invite handoff** (create a scoped invite to the private Agency server on Accept).
- **Per-guild activation/readiness state** (is this guild configured and live?).
- *(Later, not pilot)* Multi-guild managed worker iteration — only if concurrent multi-guild managed operation is ever pursued (§7).

### 3.5 What of merged ticket-lifecycle documentation still applies

`docs/17` + ADR-017 remain the authority for: the three status surfaces and their hierarchy (§1 there); frozen `tickets.status`; `lifecycleFor` fail-closed projection; transactional write of workflow_status + lifecycle_status + workflow_events + audit + outbox; idempotency/replay; the at-most-once Discord projection invariant with deterministic markers; fail-closed missing-channel handling; repair semantics (12a director-authorized, 12b explicit repair). **All of this is reused.** The Application recruitment lifecycle reuses the existing `enlistment` workflow type on this same engine (§5.5); no new recruitment/application workflow type is introduced. The *only* reframe is UX surface (§13).

---

## 4. Replacement scope

- **Preserve the existing verification/regulations gate initially.** The separate onboarding/Double-Counter/rules/VPN bot stays. Agency Workflow Console activates *after* `#reception` is unlocked; it does not re-implement verification in the first pilot. (A later slice may absorb it; not now.)
- **Replace the TicketTool reception panels/workflows** with our own configurable panel → form → private-ticket engine.
- **Application first**, then **Diplomacy** and **Contracts** on the *same configurable engine* — different panel + form + staff-routing + category config, not new bespoke code per type.
- Logging, transcripts, claiming, limits, automation are layered progressively (§6 "later parity") behind the working Application pilot.

---

## 5. Application pilot requirements (first cutover target)

### 5.1 Reception Application button
- A configurable **panel message** published to `#reception` with an **Application** button (and later Diplomacy/Contracts buttons on the same or sibling panel).
- Button publish is idempotent (deterministic marker, §3.1) so re-publishing does not duplicate panels.

### 5.2 Five-question modal (verbatim)
On button click, open a modal whose fields are **exactly** the current questions, preserved verbatim:
1. `Your Tribe history?`
2. `Why us? What stood out to you compared to other tribes?`
3. `What are your long-term goals in EF?`
4. `Do you code? Are you interested in developing tools for The Agency?`
5. `When was the last time you were wrong?`

(Discord modals support up to 5 text inputs — this fits exactly. No sixth field in the pilot.)

### 5.3 Private interview channel creation
- On modal submit, create a **private interview channel** using the existing provisioning path (`@everyone` deny + applicant allow), **plus** a staff-role allow overwrite (§6).
- Post the applicant's five answers into the channel (embed/transcript-friendly format).
- Reuse the idempotency + outbox + marker mechanics so a retried submit does not create duplicate channels.

### 5.4 Staff role routing
- The recruiter/interviewer staff role(s) are granted access to the interview channel via channel permission overwrite.
- Staff role IDs come from config (§6 / open question §15). No server-wide role grants; channel-scoped overwrites only.

### 5.5 Lifecycle: Application → Interview → Accepted / Declined → Archived
- **Reuses the existing `enlistment` workflow type** on the lifecycle engine (ADR-017 / `docs/17` §6). **No new `recruitment`/`application` workflow type is created** — the Application pilot maps onto `enlistment`'s already-implemented states and matrix. State mapping:
  - Application received → `submitted`
  - Staff review / screening → `screening`
  - Interview underway → `interview`
  - Accepted → `authorized`
  - Declined → `denied`
  - Archived → `archived`
- This corresponds to the `enlistment` matrix already in `docs/17` §6 (`submitted → screening → interview → trial_agent → authorized`/`denied`, terminals → `archived`) and to `lifecycleFor` for `enlistment` (`submitted`/`screening`/`interview`/`trial_agent` → `open`; `authorized`/`denied` → `resolved`; `archived` → `archived`). The engine, matrix, `lifecycleFor`, audit, and idempotency are reused **unchanged**.
- **Open decision — `trial_agent`.** The existing `enlistment` matrix places `trial_agent` between `interview` and `authorized`/`denied`. Whether `trial_agent` is an actual required stage for the Agency's recruitment flow (a probationary period between Interview and Accept) is an **open Agency question** (§15). The pilot does **not** invent a new workflow type to sidestep this, and does **not** implement the final acceptance transition (`interview`/`trial_agent` → `authorized`) until that question is answered. Until then, the pilot exercises `submitted → screening → interview` and the `denied`/`archived` paths.
- Driven by **staff buttons in the interview channel** (Advance / Screen / Decline / Archive — and Accept once `trial_agent` is resolved), not slash commands (§13).

### 5.6 Accepted → temporary invite handoff
- On **Accept**, optionally generate a **temporary invite** to the private Agency server (scoped: target channel, max-uses, expiry) and deliver it to the accepted applicant. Constraints in §4 of this list and §9.
- **This is invite creation, not role mutation** — compliant with ADR-011 (the bot does not grant/promote roles). The invite only lets the applicant *join*; any role assignment remains a human action.

### 5.7 Declined → archival
- On **Decline** then **Archive**, move/restrict the channel per archive-category config (channel disposition deferred to the channel-disposition slice if not ready; lifecycle state recorded regardless, per `docs/17` §13/§15).

### 5.8 Audit / logging requirements
- Every lifecycle move and every staff action writes `audit_log` (already the engine's behavior).
- A configurable **log channel** receives human-readable entries (panel published, ticket opened, claimed, advanced, accepted/declined, archived, invite issued) — this is the "logging" capability the leader specifically wants from the paid tier.
- Applicant answers and transcripts are sensitivity-tagged; log entries must not leak private interview content into public channels.

---

## 6. Configurable ticket-platform foundation

Target configuration model (designed now, built incrementally). **Pilot-required** items are needed for Application cutover; **later-parity** items are designed so the schema/relationships anticipate them but are not built first.

| Concept | Model (intent) | Pilot vs later |
|---|---|---|
| **Panels** | A panel belongs to a guild; has a target channel, title/description, and an ordered set of buttons. | **Pilot** (single Application panel). |
| **Forms / questions** | Up to 5 questions per panel/type; each has label, style (short/paragraph), required flag, order. | **Pilot** (Application's 5 verbatim). |
| **Published message/button IDs** | Persist the Discord message ID and per-button custom IDs after publish, for idempotent re-publish and click routing. | **Pilot**. |
| **Ticket categories** | Discord category ID for *open* tickets per panel/type. | **Pilot**. |
| **Overflow categories** | Secondary category used when the primary is full (Discord 50-channel category cap). | Later parity. |
| **Archive / closed routing** | Category (or restriction policy) for archived/closed tickets. | Pilot needs *a* declared archive target or an explicit "lifecycle-only, no channel move yet" setting. |
| **Staff / additional role access** | Per-panel staff role IDs that get channel-overwrite access; optional additional roles that may be added to a ticket. | **Pilot** (recruiter role). |
| **Permissions** | Which capability/role may publish panels, advance lifecycle, claim, archive, issue invites. Server-side enforced. | **Pilot** (advance/accept/decline gated). |
| **Ticket limits / duplicate prevention** | Max open tickets per user per type; reject/ point to existing open application. | Pilot (basic duplicate guard) → richer limits later. |
| **Claiming** | A staff member claims a ticket (`tickets.assignedDiscordId`), reflected in channel + log. | Later parity (pilot may ship without). |
| **Logs** | Configurable log channel + which events are logged. | **Pilot** (core events). |
| **Transcripts** | Generate a transcript on close/archive; store via adapter; post/attach. | Later parity. |
| **Automation** | Inactivity auto-close, scheduled reminders, auto-archive. | Later parity. |
| **Invite handoff config** | Target server/channel, max-uses, expiry, whether Accept auto-issues. | Pilot (Accept path) — see §9 constraints. |

**Separation principle:** the pilot ships the *vertical slice* (one panel, one form, private channel, staff lifecycle, logging, optional invite). The configuration *model* is designed to generalize so Diplomacy/Contracts and the later-parity features attach without re-architecting.

---

## 7. Hosting Model A — Kodaxa-hosted managed pilot

**Tenancy note:** this is a *managed single-tenant pilot*, not multi-tenant SaaS. Consistent with ADR-008 and ADR-001 — no billing, signup, plans, or marketplace. Kodaxa operates one bot for one customer (the Agency) as a hosted convenience.

**Single-guild-first for the pilot.** The first Application replacement runs on **one Agency-targeted active deployment profile** — a single configured guild. Concurrent Kodaxa-dev and Agency operation under one Discord bot application is a **later operational/design decision**, not a pilot prerequisite. Multi-guild managed worker iteration **may be evaluated later** but is **not required** for the first pilot and does not block it.

- **Components:** Kodaxa owns the Discord application (client ID + token). Kodaxa hosts the bot worker and PostgreSQL (current Railway + Supabase stack is acceptable here). ATCC (Vercel) is the configuration/activation surface.
- **Onboarding flow through ATCC:**
  1. Agency leader installs the bot via the (minimized, §9) invite URL from the ATCC deployment surface.
  2. Bot joins; ATCC shows the joined guild as "pending activation."
  3. Leader configures: staff/recruiter role(s), reception channel, open/archive categories, log channel, invite target — through ATCC (extends existing config surfaces + new panel/form config).
  4. Leader publishes the Application panel from ATCC (enqueues a publish outbox event).
  5. ATCC readiness check confirms: bot can read the guild, can post to reception, categories resolve, staff role resolves, log channel resolves → guild marked **active**.
- **Activation / readiness process:** reuse and extend `apps/controls/server/deployment.ts` `register_commands` (already accepts a `guildId`) and the health surface. Activation points the single active deployment profile at the Agency guild, registers any needed commands *to that guild*, and records its activation state. No multi-guild iteration is needed for the pilot.
- **Secrets/config ownership:** Kodaxa owns Discord token + DB credentials; the Agency owns *content* config (roles, channels, questions) via ATCC. The Agency never sees infra secrets.
- **Pilot operational responsibilities (Kodaxa):** worker uptime/heartbeat, DB backups, dead-letter review, deploy/rollback, log retention. The Agency leader operates the recruitment workflow and configuration only.

---

## 8. Hosting Model B — Agency-owned self-host

- **Own Discord application:** the Agency creates its own application/bot (own client ID + token). No dependency on Kodaxa's application.
- **Own server/runtime:** the Agency runs the bot worker and the controls service on their own infrastructure.
- **PostgreSQL without Railway or Supabase:** a plain PostgreSQL instance is the near-term self-host database. **No SQLite/no-database rewrite is assumed or required.** The Drizzle/postgres-js layer already targets PostgreSQL; the only coupling to remove is Supabase-pooler-specific configuration assumptions (keep `prepare:false` compatible but do not *require* a Supabase pooler).
- **Likely packaging — Docker Compose:** `bot` + `controls` + `postgres` services. (Compose files are a *future* deliverable in Slice 7; none are created in this pass.) Single-guild operation (ADR-001) is the natural self-host shape — no multi-guild iteration needed.
- **Setup / bootstrap / backups / update path (to be specified in Slice 7):**
  - Bootstrap: provide env (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `DATABASE_URL`), run migrations, start services, install bot to the guild, configure via controls.
  - Backups: documented `pg_dump`/volume-snapshot path; no managed-service assumption.
  - Updates: pull new image/build, run migrations, restart — reversible.
- **Storage adapter boundaries:** transcripts and any object storage must go through an **adapter interface** with at least: a local-filesystem/volume adapter (self-host default) and a managed-bucket adapter (e.g. Supabase Storage) for Model A. Self-host must not require a cloud bucket. The adapter boundary is defined now; implementations land with transcripts (later parity).

---

## 9. Permission minimization

Distinguish the permissions needed by *function*, and request only what the recruitment pilot actually uses:

| Function | Minimum Discord permission(s) | Notes |
|---|---|---|
| Install / appear in guild | (install scope) `bot applications.commands` | Scope, not a permission bit. |
| Read reception & post panel | View Channel, Send Messages, Embed Links | |
| Create private interview channel | Manage Channels | Plus the bot needs to be able to set the overwrites it grants. |
| Apply private permission overwrites | Manage Roles **(channel-scoped via bot's own role)** | Server-wide "Manage Roles" is broader than ideal; prefer positioning the bot's role so it can edit overwrites without server-wide role authority. Flag for review. |
| Post transcripts / attachments | Attach Files, Read Message History | Later parity (transcripts). |
| Create temporary invite | Create Instant Invite | Scoped to the invite target channel. |

**Broad permissions to NOT retain unless justified:** Administrator, Manage Server/Guild, Kick Members, Ban Members, Manage Webhooks (unless transcripts require it), Mention Everyone, and any server-wide role-management beyond what channel overwrites need. The current global `DISCORD_BOT_PERMISSIONS` posture (designed for a trusted operations guild) should be replaced for the recruitment install with a **minimal computed integer** matching the table above.

**Authority rule (ADR-011 reaffirmed):** the console must **not** automatically grant, remove, promote, demote, ban, or kick roles. Accept issues an *invite*, not a role. No authority mutation is authorized by default; any future role-granting feature requires a separate explicit decision.

---

## 10. Migration / coexistence plan

- **Pilot Application alongside existing TicketTool.** Run our Application panel in parallel (e.g. a staging/test reception channel or a clearly-labeled second button) while TicketTool stays live. Do not remove TicketTool until cutover acceptance passes.
- **Avoid risking real applicant data during initial tests.** Initial tests use a test channel/category and test/staff accounts only — no real applicants routed through the unproven path. Private interview content is sensitivity-tagged; logs never echo private answers to public channels.
- **Cutover acceptance requirements (Application):**
  - Panel publishes idempotently; button opens the 5-question modal.
  - Submit creates exactly one private channel with correct applicant + staff access; answers posted.
  - Staff buttons drive Application → Interview → Accepted/Declined → Archived; every move audited and logged.
  - Accept issues a correctly-scoped temporary invite (if enabled); Decline archives.
  - Duplicate/limit guard prevents a second open application by the same user.
  - Fail-closed behavior verified (missing channel/category does not silently lose state).
- **Later replacement of Diplomacy and Contracts:** once Application is accepted in production, add Diplomacy and Contracts as additional panels/forms/staff-routing on the same engine; repeat the parallel-run + acceptance pattern per type before retiring the corresponding TicketTool button.

---

## 11. Revised implementation sequence

Bounded slices. Each ends deployable/reversible and runs the standard gates. **No slice is authorized to start until this doc is reviewed.**

- **Slice 0 — Pivot docs/roadmap & architecture alignment** *(this pass)*. This document + ADR-018 + roadmap amendment note (§14). No code.
- **Slice 1 — Panel/form/config schema foundation + ATCC config visibility.** New config tables (panels, forms/questions, categories, staff-routing, published IDs, per-guild activation state); migrations; ATCC read/edit surfaces. No Discord behavior yet.
- **Slice 2 — Application panel publish + 5-question modal + private interview channel.** Publish outbox event + idempotent panel; button → modal (verbatim 5 questions) → private channel with applicant + staff overwrite; answers posted. Test channel only.
- **Slice 3 — Staff button lifecycle + archival + audit/logging.** Drive the **existing `enlistment` workflow** (§5.5) from staff buttons (Advance/Screen/Decline/Archive); configurable log channel; full audit. Final acceptance transition (`→ authorized`) gated on the `trial_agent` Agency decision (§15). (Reuses ADR-017 engine; this is where the WIP lifecycle engine is repurposed — §13.)
- **Slice 4 — Temporary invite handoff with safety constraints.** Scoped invite creation on Accept (target/max-uses/expiry config); ADR-011-compliant (no role grant); audited.
- **Slice 5 — Transcripts / claiming / limits / automation.** Storage adapter boundary (local + bucket); transcript generation/post; claiming (`assignedDiscordId`); ticket limits/duplicate protection; inactivity automation. Prioritized by leader need (logging already in Slice 3).
- **Slice 6 — Diplomacy & Contracts panel rollout.** Additional panels/forms/staff-routing/categories on the same engine; parallel-run + per-type acceptance.
- **Slice 7 — Managed Agency acceptance + self-host packaging.** Model A single-guild activation/readiness polish (multi-guild iteration is a later, separate decision — §7); Model B Docker Compose (bot+controls+postgres), bootstrap/backup/update docs, de-Supabase-coupling.

(Operations-surface work — evidence/intel/clearance governance from `docs/16` Sprints 1–8 — continues as the *private* surface track, re-prioritized behind the recruitment pilot. §14.)

---

## 12. Decision on the pending transition implementation

- The **slash-command-centered transition UX is paused as a user-facing recruitment plan.** `/ticket transition` and `/ticket repair` will **not** be the recruitment-server interface; the leader explicitly rejected routine slash commands for this workflow.
- The **lifecycle engine itself is reused internally.** `lifecycleFor`, `canTransitionWorkflow`, the declarative matrix, transactional workflow_status + lifecycle_status + workflow_events + audit + outbox writes, idempotency/replay, and the at-most-once Discord projection invariant (ADR-017 / `docs/17`) are **kept** and become the backend for the button-driven **`enlistment` workflow** that the Application pilot reuses (§5.5, Slice 3) — no new workflow type.
- **Status of the uncommitted WIP on `feature/ticket-transition-engine`:** preserved, not discarded. It is a valid backend slice. Its slash-command handler/registration is **superseded as the recruitment UX** but may remain useful for operations-surface/operator use (or internal/testing) — to be decided when Slice 3 repurposes the engine. No code on that branch is modified by this pass.
- **Net:** keep the engine, re-front the UX. ADR-017 is not retracted; this doc records that its §15 "operator transitions arrive only via Discord slash command in this slice" assumption is overtaken for the recruitment surface by button/modal interaction.

---

## 13. Why button/modal, not slash commands (UX reframe)

The merged design assumed operator-initiated slash-command transitions (`docs/17` §15). The recruitment customer's UX is the opposite: applicants click a button and fill a modal; staff click buttons in the ticket channel. The existing `handlers.ts` button/modal pipeline (§3.1) already supports this exact shape — the reframe is low-risk and reuses proven code. Slash commands remain available for operator/operations contexts but are not the recruitment-server interface.

---

## 14. Roadmap linkage (amendment, not rewrite)

`docs/16_COMPLETION_ROADMAP.md` is **re-sequenced, not replaced**:

- Its **Sprint 2 (Workflow Engine Completion)** explicitly anticipated "Bot commands/**buttons/modals** for common transitions" and "Use idempotency keys for interaction-driven transitions" — this pivot *narrows and prioritizes* that into the Application intake slices (§11 Slices 2–4) and elevates them ahead of the operations governance surfaces.
- Its **Sprint 9 (Agency Rollout Path)** anticipated "Bot install verification," "Per-guild command registration from controls," and "Agency guild bootstrap checklist" — these become the Hosting Model A activation work (§7, Slice 7).
- The **operations governance surfaces** (Sprints 1, 3–8: retention/exports/evidence depth/appeals/profiles) are **not cancelled**; they continue as the *Agency Terminal Operations* (private) track behind the recruitment pilot.
- ADR-001 (single-guild-first) and ADR-008 (not-SaaS) are **reaffirmed**: Model A is managed single-tenant, Model B is self-host single-guild. No multi-tenant SaaS positioning.

No wholesale rewrite of `docs/16` is performed in this pass; this section is the superseding/amendment note it points to.

---

## 15. Open questions requiring Agency input

Minimal and operational:

1. **Is `trial_agent` a required stage?** — the existing `enlistment` matrix has `interview → trial_agent → authorized`. Does the Agency's recruitment flow need a probationary `trial_agent` stage between Interview and Accept, or does Interview go straight to Accept (`authorized`)? The pilot maps onto `enlistment` either way (no new workflow type) and does **not** implement the final acceptance transition until this is confirmed.
2. **Recruiter/interviewer role ID(s)** — which Discord role(s) get interview-channel access and may advance/screen/decline (and accept, once Q1 is resolved)?
3. **Category IDs** — open (active interview) category, archive category, and whether an overflow category is needed day-one.
4. **Invite target & scope** — which private Agency server/channel does an accepted applicant get invited to, and what expiry / max-uses?
5. **Transcripts on day-one?** — required for the Application cutover, or deferred to later parity?
6. **Claiming behavior** — should an interviewer "claim" a ticket (single assignee), or is shared staff access enough for the pilot?
7. **Diplomacy / Contracts** — do they need *separate* staff roles and *different* form questions, or do they share the recruiter role and a generic form?

---

## 16. Constraints honored by this pass

No application code, schema, migration, env, or ATCC/bot source was modified. No deployment, guild activation, command registration, or Discord-permission change was made. No branch was merged. The uncommitted `feature/ticket-transition-engine` WIP and the untracked scratch files (`pr-body.txt`, `tmp_old_styles.css`) were left exactly as found. This document and ADR-018 are the only additions.
