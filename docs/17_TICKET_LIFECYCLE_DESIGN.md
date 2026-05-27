# Ticket Lifecycle — Transitions, Repair, Archive (design)

**Status:** Design pass, not yet implemented. Drafted on `design/ticket-lifecycle`.
**Baseline authority:** [`docs/05_WORKFLOW_STATE_MACHINES.md`](./05_WORKFLOW_STATE_MACHINES.md) (read-only this slice).
**Companion ADR:** [`docs/adrs/ADR-017-ticket-transition-authority-and-event-model.md`](./adrs/ADR-017-ticket-transition-authority-and-event-model.md).
**Companion follow-ups:** Open contradictions with `docs/05` are listed at the end for separate review; this design does not amend `docs/05`.

This document specifies how a ticket moves through its lifecycle after it has
been created. The current `createTicket()` path is the *only* implemented state
mutation — every other state in the schema is reachable in the database but
unreachable from the application. This design closes that gap.

---

## 1. Authority relationship among the three status surfaces

The schema defines three state columns on the ticket entity:

| Column                              | Type                      | Today's use                                 |
|-------------------------------------|---------------------------|---------------------------------------------|
| `tickets.status`                    | `ticket_status` (enum)    | Written once at creation as `"submitted"`; never updated; never read for authority decisions. |
| `tickets.lifecycle_status`          | `ticket_lifecycle_status` (enum) | Written once at creation as `"open"`; never updated; consumed by `TicketsPage` for display. |
| `workflow_instances.workflow_status`| `text` (CHECK-constrained per type) | Written once at creation; never updated; not read by any UI today. |

Authority hierarchy going forward:

1. **`workflow_instances.workflow_status` is the single source of truth for domain progression.** All transitions mutate it and write a `workflow_events` row. Per-workflow state diagrams from `docs/05` target this column.
2. **`tickets.lifecycle_status` is a derived projection** of `workflow_status`, computed by the pure function `lifecycleFor(workflow_type, workflow_status) → ticket_lifecycle_status` and written in the same transaction as the workflow mutation. Read-side answer to "is the Discord case open or closed?" — never "what stage is this workflow in?"
3. **`tickets.status` has no authority** going forward. See §2.

The two authoritative writes (workflow_status, derived lifecycle_status) and the workflow_event audit row occur in a single transaction. No path mutates one without the other.

---

## 2. Disposition of `tickets.status`

`tickets.status` is **frozen** after current creation behavior:

- Written exactly once by `createTicket()` with the default `"submitted"`. Creation code is not modified.
- Never read for routing, authority, capability, projection, or display in any layer added by this design.
- Never updated by the transition service or any code path added by this design.
- **No synchronization with `lifecycle_status`.** An earlier draft proposed lockstep copying, but the enums do not align: `ticket_lifecycle_status` includes `open`, `escalated`, `resolved`, none of which are valid `ticket_status` members. Any copying rule would either reject writes silently or persist a stale contradictory value (e.g., `lifecycle_status = resolved` while `status = submitted`). Freezing avoids that class of inconsistency.

**Observability today vs. after this design:**

- The existing controls Tickets UI renders `lifecycleStatus` (not `status`), so freezing `tickets.status` does **not** misrepresent ticket state in the UI. Lifecycle display will continue to update as the transition service writes `lifecycle_status`.
- The current `listTickets()` DTO still exposes `status: row.status` for backward compatibility. **No new consumer may interpret `tickets.status` as workflow meaning.** Existing consumers that read it will see the frozen `"submitted"` value; this is documented, not a defect to fix in this slice.
- DTO-field removal or explicit API deprecation of `status` is deferred to a later read-model cleanup slice.

**Removal/backfill plan** (separate later migration slice):

1. (this design) stop reading `tickets.status` everywhere; transition service does not touch it.
2. drop the two indexes that reference it (`idx_tickets_guild_status`, `idx_tickets_type_status`).
3. backfill `tickets.status` from `workflow_status` for historical analytical use if needed, then drop the column and the DTO field together.

---

## 3. First implementation workflow subset

The first implementation slice implements transitions for **two workflows** in this order:

1. **`general`** — smallest matrix; lowest blast-radius validation of the pattern.
2. **`enlistment`** — operationally most active; existing fixtures.

`clearance`, `contract`, `intel`, and `doctrine_challenge` are explicitly **deferred to follow-up slices**. The transition service surface is designed to admit them later without an interface change.

Rationale for ordering:

- `general` first exercises the transition/audit/projection engine on the smallest possible matrix with no authority-sensitive states. Mistakes in the engine become visible without touching meaningful authority.
- `enlistment` second exercises judgement transitions (creator/judge separation) without any director-bearing authority outcomes.
- **`clearance` is deferred deliberately.** It is authority-sensitive: its terminal states (`approved`, `revoked`, `temporary`) communicate operator-grade trust. It will not be enabled until the engine's audit, idempotency, projection, and rejection behavior have all passed live acceptance on the lower-authority workflows.
- `contract`, `intel`, `doctrine_challenge` depend on additional record state (`contract_details`, `doctrine_challenges`) and on capabilities or actor rules not yet established in implemented policy. See §5 — capability rules for deferred workflows are intentionally omitted from this design pass.

---

## 4. `performance_evidence` contradiction

Baseline-vs-implementation mismatch:

- `docs/05` declares `performance_evidence` as a `WorkflowType` and describes an Evidence Workflow.
- `packages/db/schema/enums.ts` declares it in both `ticket_type` (`enums.ts:7`) and `workflow_type` (`enums.ts:41`).
- `packages/db/src/tickets.ts` narrows the application `TicketType` union to six values, omitting it (`tickets.ts:6-12`); `getInitialWorkflowStatus()` has no case for it.

This design treats `performance_evidence` as **excluded from the first transition implementation subset** — neither a deferred ticket workflow nor a removed concept. The design does **not** decide whether `performance_evidence` will ever be implemented as a ticket-routed workflow, whether it should be removed from the enums, or whether a later non-authoritative ticket mirror of evidence state should exist.

Evidence is canonical in the `evidence` table with its own state machine (`addReview`, `directorOverrideEvidence`, `markEvidenceStale`); per ADR-011 no ticket workflow may automatically mutate evidence authority. Any future integration is a separate evidence/ticket decision, not prejudged here.

For this slice, the transition service rejects any attempt to transition a `performance_evidence` ticket with `WORKFLOW_TYPE_NOT_IMPLEMENTED` (§7), uniformly with `clearance`, `contract`, `intel`, `doctrine_challenge`. `performance_evidence` tickets cannot be created in practice because `TicketType` excludes the value, so the rejection is defense-in-depth — not a statement about future implementability.

---

## 5. Actor and capability requirements

Every transition is initiated by an actor (a Discord user via the bot, or — in a future slice — a controls operator). Required capabilities are declared only for the in-scope workflows of §3. Capability rules for deferred workflows are **not** specified in this design pass; they are owned by the slice that implements each one.

| Workflow      | Capabilities allowed to transition                          |
|---------------|-------------------------------------------------------------|
| `general`     | `can_manage_config` (only — `general` is operational housekeeping) |
| `enlistment`  | `can_manage_enlistment` OR `can_manage_config`              |

For both in-scope workflows, **`can_manage_config` is the director-authorized path** (§12a). It bypasses actor-capability and judgement gating but **does not** bypass the state-machine matrix. Bypassing the matrix requires the explicit repair operation (§12b).

**Self-transitions:** the actor must not be the creator of the ticket for transitions that confer judgement (e.g., enlistment `screening → interview`). The list of "judgement transitions" per workflow is part of the transition matrix (§6). A `can_manage_config` actor bypasses this rule via the director-authorized path.

Capability checks happen in **both** the bot handler and the transition service. The service is the authoritative layer; the bot handler check is for fast UX denial. This mirrors the pattern from §6 of `docs/09_SECURITY_PRIVACY_COUNTERINTEL.md` and the controls broad-endpoint design.

---

## 6. Transition matrices

The full state diagrams are owned by `docs/05`. This section names, for each **in-scope** workflow (§3), the subset of transitions the first implementation will support, and the judgement-restricted ones (where actor ≠ creator). Deferred workflows are intentionally not specified here.

### General

```text
submitted        → under_review     (operational)
under_review     → waiting_on_user  (operational)
under_review     → resolved         (operational)
waiting_on_user  → resolved         (operational)
resolved         → archived         (operational)
```

No judgement transitions. Every transition is operational housekeeping; actor must hold `can_manage_config`. There is no direct `* → archived` path that skips `resolved`; per §13, a general ticket must enter `resolved` before it can be archived. `waiting_on_user` resolves forward — it does not dead-end.

### Enlistment

```text
submitted    → screening    (judgement)
screening    → interview    (judgement)
screening    → denied       (judgement)
interview    → trial_agent  (judgement)
interview    → denied       (judgement)
trial_agent  → authorized   (judgement)
trial_agent  → denied       (judgement)
authorized   → archived     (operational, any allowed actor)
denied       → archived     (operational, any allowed actor)
```

Judgement transitions require actor ≠ creator. `authorized` and `denied` are terminal workflow states from which only `archived` is reachable.

### Service interface

The transition service exposes `canTransitionWorkflow(type, from, to) → boolean` as a pure function fed by a single per-workflow declarative table. New workflows are added by extending the table, not by adding code paths. The declarative table also encodes the `judgement` / `operational` classification per transition.

---

## 7. Invalid-transition handling

The transition service treats every transition request as a sequence of typed checks. Failing any writes no mutation, audits the rejection, and returns the typed error:

1. **Workflow type is enabled.** Workflow type is in the first enabled subset (§3). If not, `WORKFLOW_TYPE_NOT_IMPLEMENTED`. Applies uniformly to `clearance`, `contract`, `intel`, `doctrine_challenge`, `performance_evidence`.
2. **Workflow instance exists.** The ticket has a `workflow_instances` row. If not, `WORKFLOW_INSTANCE_MISSING`.
3. **Lifecycle projection is defined.** `lifecycleFor(type, requestedStatus)` returns a mapping for the requested target. If the workflow is enabled but the target state is not mapped, `LIFECYCLE_MAPPING_MISSING`. Never default to `open`; never silently project.
4. **Transition edge is declared.** `canTransitionWorkflow(type, from, to)` returns true. If not, `INVALID_TRANSITION`. (Reserved for disallowed state edges *within* enabled workflows only.)
5. **Actor has the capability.** Per §5. If not, `ACTOR_NOT_AUTHORIZED`.
6. **Judgement constraint, if applicable.** Actor is not the creator on a judgement transition. If violated, `JUDGEMENT_CONFLICT`. Director-authorized path (§12a) bypasses.

Each error has a distinct internal code; the bot handler surfaces a short, non-leaking message to the requesting user. The full `(from, to, reason)` triple is written to `workflow_events` only when the mutation succeeds. **Rejected transitions are written to `audit_log`, not `workflow_events`** — see §8.

The Discord-facing reply is one of two templates, grouped by internal error code:

- **`Transition not allowed in current state.`** — for `WORKFLOW_TYPE_NOT_IMPLEMENTED`, `WORKFLOW_INSTANCE_MISSING`, `LIFECYCLE_MAPPING_MISSING`, `INVALID_TRANSITION`, `JUDGEMENT_CONFLICT`.
- **`You are not authorized to perform this transition.`** — for `ACTOR_NOT_AUTHORIZED`.

These templates do not differentiate sub-causes, to avoid leaking workflow internals. The exact internal code is recorded in `audit_log`.

---

## 8. Event and audit rules — successful and rejected transitions

| Event                                        | Table              | Written when                          | Contents                                                                                                                                            |
|----------------------------------------------|--------------------|----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------|
| Successful transition                        | `workflow_events`  | After mutation succeeds, same tx       | `workflow_instance_id`, `actor_discord_id`, `from_status`, `to_status`, `reason` (caller-provided, optional), `payload` (`{ ticketId, idempotencyKey }`) |
| Successful transition (cross-cutting)        | `audit_log`        | After mutation succeeds, same tx       | `action = 'ticket_transition_applied'`, `subject_type = 'ticket'`, `subject_id = ticketId`, `payload = { from, to, workflowType }`                  |
| Rejected transition                          | `audit_log`        | On any rejection (no mutation)         | `action = 'ticket_transition_rejected'`, `subject_id = ticketId`, `payload = { from, attemptedTo, internalCode, workflowType }`                     |
| Lifecycle projection write                   | (no separate event) | Same tx as workflow mutation          | Implicit; `tickets.lifecycle_status` is updated alongside `workflow_status`. Not separately audited.                                                |

**Rejected transitions are audited but do not append to `workflow_events`.** Rationale: `workflow_events` is the lineage record of "what happened to this workflow", and a rejected attempt did not happen. Audit log is the cross-cutting actor accountability surface and is the correct home for "an actor attempted X and was denied".

---

## 9. Transactional boundaries

Each successful transition is one DB transaction containing:

1. Idempotency claim (§10).
2. Read current `workflow_instances` row by `ticket_id` (FOR UPDATE).
3. Re-check `canTransitionWorkflow(type, current_status, requested_status)` under the lock.
4. Update `workflow_instances` (`workflow_status`, `status_reason`, `updated_at`).
5. Update `tickets` (`lifecycle_status` via `lifecycleFor()`, `updated_at`, and `closed_at` per the policy in §13). **`tickets.status` is not touched.**
6. Insert `workflow_events` row.
7. Insert `audit_log` row (`ticket_transition_applied`).
8. Enqueue Discord outbox event (§11) — the outbox row is inserted in the same tx.
9. Idempotency completion (§10).

Step 3 (re-check under lock) is required because the actor-capability and `canTransitionWorkflow` checks happen before the transaction. Without re-check, a concurrent transition could leave the workflow in a state that makes the requested target invalid.

Rejection paths are also wrapped in a transaction (the audit-log write of the rejection is durable) but contain no row-level locking.

---

## 10. Idempotency and replay model

Transitions are idempotent via the existing `idempotency_keys` mechanism:

- Scope string: `ticket:transition`.
- Key format: `ticket:transition:{ticketId}:{transitionRequestId}` where `transitionRequestId` is the Discord interaction ID for bot-driven transitions, or a UUID minted by the bot handler.
- Result blob: `{ ticketId, from, to, workflowEventId }`.

On replay, the service returns the stored result blob without mutating again. The replay path returns the same Discord-facing reply that the original request returned.

Direct database concurrency (two transition requests with different keys arriving simultaneously for the same ticket) is handled by the `FOR UPDATE` lock in §9; the loser observes the new state and is rejected with `INVALID_TRANSITION` if its requested target is no longer reachable.

---

## 11. Discord projection and outbox requirements

A successful transition enqueues a new outbox event:

- New `OutboxEventType` **`ticket_transition`** added to the union in `outbox.ts`. No existing event types are modified.
- Payload: `{ ticketId, ticketShortId, workflowType, fromStatus, toStatus, actorDiscordId, workflowEventId }`.
- Outbox idempotency key: `ticket:transition:{ticketId}:{workflowEventId}`.

**Invariant.** For each `workflowEventId`, the projector produces at most one Discord transition message and at most one `discord_transition_projected` audit row. The implementation may pick the concrete uniqueness mechanism (unique index on `(workflowEventId, action)`, advisory lock, conditional insert, etc.) — the invariant is what must hold.

**Retry behavior.** Each attempt inspects two anchors: the deterministic Discord marker `[ticket-transition:{workflowEventId}]` (mirroring `getTicketChannelMarker`/`getStaleAlertMarker` in `apps/bot/src/safety.ts`) and the projection audit row.

- marker present + audit row present → no send; no new audit; reconcile delivery only.
- marker present + audit row missing → no send; write the audit row once, then reconcile.
- marker missing → send once (marker placed as trailing tag on the message), then write the audit row once.

**Fail-closed on missing/unusable channel.** If `tickets.channel_id` does not resolve to a usable channel, the projector does **not** attempt recreation. It:

- Writes `audit_log` action `ticket_transition_channel_missing` with `{ ticketId, channelId, workflowEventId, reason }`.
- Marks the outbox row `failed` so it follows standard backoff; on `max_attempts` it lands in `dead` for operator review.
- Does **not** create a substitute channel, post elsewhere, or alter ticket state. Automatic recreation is the later channel-repair slice (§12c).

---

## 12. Repair semantics

This section distinguishes three operator paths. Only **12a** and **12b** are in the first implementation slice. **12c** is intentionally deferred.

### 12a. Director-authorized transition (within the matrix)

A `can_manage_config` actor performs a transition that the state machine *allows*, but that the per-workflow capability or the judgement constraint would otherwise reject. Examples:

- Director moves an enlistment through `screening → interview` when no `can_manage_enlistment` actor is available.
- Director performs a judgement transition where they were also the creator (judgement-conflict bypass).

This path:

- **Bypasses** actor-capability and judgement gating.
- **Does not bypass** the state-machine validity check. The requested transition must appear in the matrix of §6.
- Produces a normal `workflow_events` row and a normal `audit_log` action `ticket_transition_applied`, with `payload.directorOverride = true`.
- Requires no `reason` field beyond what any transition would carry.

This is the routine director path. Most director-initiated transitions land here, not in 12b.

### 12b. Explicit repair (bypasses the matrix)

A `can_manage_config` actor performs a transition that the state machine would normally **reject** (e.g., enlistment `archived → trial_agent` to undo a mistaken denial). This is a privileged operation distinct from 12a.

Requirements:

- Actor holds `can_manage_config`.
- Caller supplies a non-empty `reason` string; empty or missing `reason` rejects the request.
- Target must be a valid `workflow_status` for the workflow type (DB CHECK constraint).
- **Repair bypasses only the transition-edge matrix (`INVALID_TRANSITION`).** It does **not** bypass `WORKFLOW_TYPE_NOT_IMPLEMENTED`, `WORKFLOW_INSTANCE_MISSING`, or `LIFECYCLE_MAPPING_MISSING`.
- **First-implementation-slice scope:** repair is permitted only for `general` and `enlistment`. Any other workflow type rejects with `WORKFLOW_TYPE_NOT_IMPLEMENTED`.
- **Target must have an approved `lifecycleFor()` mapping** for its workflow type. Targets without a mapping reject with `LIFECYCLE_MAPPING_MISSING` even via repair.

Effects:

- `workflow_events` row with `payload.repair = true` and the supplied `reason`.
- `audit_log` row with `action = 'ticket_transition_repair'`, `payload = { from, to, workflowType, reason, priorStatus }`.
- All other transaction guarantees from §9 hold (lock, idempotency, outbox).

Only the transition-edge matrix check is bypassed; type, instance-exists, lifecycle-mapping, idempotency, and the transactional event/audit writes all run normally.

### 12c. Channel repair / recreation — **deferred to a later slice**

The first implementation does **not** automatically recreate a missing channel; §11's fail-closed response (`ticket_transition_channel_missing` audit, outbox row `failed` through backoff, no substitute channel) is the entire missing-channel response. Recreation with reconstructed permissions and history replay is a later dedicated repair slice. That slice will own detection criteria, permission reconstruction (everyone-deny + creator-allow + officer-allow), replay policy, and an operator-dashboard trigger. The split is deliberate: wrong permissions on a recreated channel could leak ticket details, and that risk must not be bundled with the transition engine's first acceptance.

All in-scope paths (12a, 12b, §11 fail-closed) are auditable. No first-implementation path mutates ticket state without writing both `workflow_events` (on success) and `audit_log`.

---

## 13. Resolve-versus-archive policy

`tickets.lifecycle_status` enum supports `open | waiting_on_user | waiting_on_staff | escalated | resolved | archived`. For the in-scope workflows the engine only produces `open | waiting_on_user | resolved | archived`.

**Direct-to-archived is not permitted for any in-scope workflow.** Every archival must transit through a workflow state whose `lifecycleFor` projection is `resolved` first. Matrices in §6 contain no skip arc. A future workflow that needs direct archival must declare it explicitly and be re-reviewed.

Auto-archival is **not** in this slice; every `resolved → archived` is operator-initiated. Channel disposition for `archived` (move to archive category, restrict visibility) is **deferred to the channel-repair slice** (§12c); the engine records the lifecycle change without applying Discord permission changes.

**`closed_at` policy:**

`closed_at` represents the ticket's **current** terminal closure — not its historical close. Historical closure/reopening evidence remains in `workflow_events` and `audit_log`.

- Set when `lifecycle_status` enters `resolved`.
- Preserved on `resolved → archived`.
- **Cleared** when an explicit repair (§12b) moves `lifecycle_status` from `resolved` or `archived` back to a non-terminal lifecycle (`open`, `waiting_on_user`, `waiting_on_staff`, `escalated`). An active ticket must not appear closed.
- Re-set to the new closure time if the workflow later resolves again.

### 13a. `lifecycleFor(workflow_type, workflow_status)` mapping tables

`lifecycleFor()` is **fail-closed**: defined only for enabled workflow types, and only for the states declared in the mapping table below. It never defaults to `open` for an unrecognized pair. Two distinct error paths:

- Non-enabled workflow type: rejected at §7 step 1 with `WORKFLOW_TYPE_NOT_IMPLEMENTED`. `lifecycleFor()` is never called.
- Enabled workflow but the requested target state is not in the table: rejected at §7 step 3 with `LIFECYCLE_MAPPING_MISSING`. No state mutation.

**General:** `submitted`/`under_review` → `open`; `waiting_on_user` → `waiting_on_user`; `resolved` → `resolved`; `archived` → `archived`.

**Enlistment:** `submitted`/`screening`/`interview`/`trial_agent` → `open`; `authorized`/`denied` → `resolved`; `archived` → `archived`.

`escalated` is not produced by any enabled workflow this slice.

---

## 14. Evidence-linked mirror rule (no duplicate evidence authority)

Per `docs/05` and ADR-011, evidence is authoritative in the `evidence` table. The `evidence.ticket_id` foreign key lets evidence reference an originating ticket, but evidence does not derive its authority from the ticket's workflow.

The mirror rule for evidence-linked tickets:

- If a ticket has at least one evidence row pointing at it (`evidence.ticket_id = ticketId`), the ticket's `workflow_status` may **observe** the linked evidence's state via projection (e.g., display "evidence validated" in the Discord channel) but does **not** transition based on evidence changes.
- The transition service ignores evidence state entirely. Mirroring is purely a read-side projection performed by the outbox processor or controls display.
- Evidence's own service (`addReview`, `directorOverrideEvidence`) does not call into the ticket transition service. If a future product decision wants evidence validation to also archive the originating ticket, that integration is an explicit follow-up slice and must be implemented as a separate outbox event from evidence to ticket — never as a direct service call.

This preserves the "evidence is canonical; tickets project" boundary stated in `docs/05`.

---

## 15. ATCC display implications

**No ATCC code changes are required in the first transition implementation slice.** ATCC remains exactly as deployed. The existing `lifecycle_status` rendering will naturally reflect changes because transitions update that column.

Explicitly deferred to a later controls-display slice:

- Workflow-specific status (`workflow_status`) display alongside lifecycle.
- Read-only event-history surface (e.g. `/api/tickets/:id/events`).
- Any operator-initiated transition action in ATCC. Operator transitions arrive only via Discord (slash command) in this slice.

The deferral is deliberate: ATCC display changes should not gate transition-engine live acceptance, and any operator-side transition surface is a separate product decision after the engine has stabilised.

---

## 16. Implementation acceptance test plan

Covers only the revised initial subset (`general`, `enlistment`). ATCC endpoint acceptance and automatic channel recreation are explicitly out of scope; they belong to later slices (§15, §12c).

**Unit-level (service):**
- `canTransitionWorkflow` per-workflow table covers every declared transition (§6) and at least one negative case per state.
- `lifecycleFor(type, status)` is exhaustive over `general` and `enlistment` per §13a.
- §12a director-authorized path bypasses actor-cap/judgement but **not** the matrix.
- §12b explicit-repair path bypasses the matrix, requires non-empty reason, writes `ticket_transition_repair`.

**Service-level (DB):**
- `transitionTicket()` writes `workflow_instances`, `tickets.lifecycle_status`, `closed_at` per §13, `workflow_events`, `audit_log`, and the outbox row in one transaction; partial-failure rollback verified.
- `tickets.status` remains `"submitted"` after every transition (frozen per §2).
- `closed_at` is set on `open → resolved`, preserved on `resolved → archived`, **cleared** when a §12b repair returns lifecycle from `resolved`/`archived` to a non-terminal state, and re-set on subsequent re-resolution.
- A transition request for a non-enabled workflow type rejects with `WORKFLOW_TYPE_NOT_IMPLEMENTED` and writes one rejected-attempt `audit_log` row; no state mutation occurs.
- A request whose target state is not in the `lifecycleFor` table for an enabled workflow rejects with `LIFECYCLE_MAPPING_MISSING`; no default-to-`open` projection happens.
- Idempotent replay returns the same result blob; no double-writes.
- `FOR UPDATE` lock prevents lost-update under concurrent claims.
- Rejected transitions write exactly one `audit_log` row and zero `workflow_events` rows (contradiction with `docs/05` noted in §17).

**Outbox-level (bot):**
- `ticket_transition` events include the deterministic marker `[ticket-transition:{workflowEventId}]` on the posted message.
- **Invariant verified:** per §11, each `workflowEventId` produces at most one Discord message and at most one `discord_transition_projected` audit row. The three retry scenarios (marker+audit both present; marker present only; marker missing) are each exercised individually and each respects the invariant.
- **Fail-closed missing channel:** when `tickets.channel_id` does not resolve, the projector writes `ticket_transition_channel_missing` audit, marks the outbox row `failed` per backoff, and does **not** create a substitute channel.

**End-to-end (live dev guild, recorded in `docs/AUTHORIZATION_MATRIX_RUNS.md` or a new lifecycle run log):**
- General ticket transits `submitted → under_review → resolved → archived`.
- Enlistment ticket transits `submitted → screening → interview → trial_agent → authorized → archived` driven by an actor holding `can_manage_enlistment`.
- Self-transition on a judgement transition rejected with the neutral reply.
- §12a director-authorized normal-matrix transition succeeds; audit carries `payload.directorOverride = true`.
- §12b explicit repair on a `resolved`/`archived` ticket clears `closed_at`; a subsequent re-resolution sets a new `closed_at`. Audit uses `ticket_transition_repair`.
- A transition attempt against a non-enabled workflow type (e.g. `clearance`) returns `WORKFLOW_TYPE_NOT_IMPLEMENTED`, writes one rejected-attempt audit row, and produces no state change.
- Same `workflowEventId` projected twice yields exactly one Discord message and one audit row.
- Simulated missing channel produces the expected fail-closed audit and outbox state; no substitute channel is created.

---

## 17. Open contradictions with `docs/05` — flagged for separate review, not amended here

Mismatches identified during this design. Each is recorded for a future targeted amendment to `docs/05`. **This design does not modify `docs/05`, the enums, or the application `TicketType` union.**

1. **`performance_evidence` workflow declaration vs. application union.** `docs/05` declares it; the `ticket_type`/`workflow_type` enums include it; the application `TicketType` union and `getInitialWorkflowStatus()` omit it. This design excludes it from the first transition subset only (§4); no enum-removal recommendation is made here.

2. **Evidence Workflow section of `docs/05` describes states as if they were a ticket workflow.** Evidence is a first-class entity with its own state machine (`addReview`/`directorOverrideEvidence`). The Evidence Workflow text would benefit from reframing as a Discord-UX projection or a cross-reference to `docs/04_EVIDENCE_LEDGER.md`.

3. **Three-status surface is not acknowledged in `docs/05`.** The doc covers `lifecycle_status` and per-workflow `workflow_status` but not `tickets.status`. The amendment should note `tickets.status` as frozen per this design and ADR-017.

4. **Repair semantics are absent from `docs/05`.** §12a/12b/12c (director-authorized, explicit repair, channel-repair-deferred) are not in the baseline. A short cross-reference would close the gap.

5. **`docs/05` line ~52 says "transition attempts write `workflow_events`".** This design writes `workflow_events` only on **successful** transitions; rejected attempts write `audit_log` only (§8). A targeted amendment to `docs/05` should reframe to "successful transitions write `workflow_events`; rejected attempts write `audit_log`."

None is urgent; all are documentation-only.
