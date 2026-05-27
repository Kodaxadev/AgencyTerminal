# ADR-017 — Ticket Transition Authority and Event Model

## Status

Proposed. Pending review of [`docs/17_TICKET_LIFECYCLE_DESIGN.md`](../17_TICKET_LIFECYCLE_DESIGN.md). No implementation.

## Context

The ticket entity in Agency Terminal has three state columns:

- `tickets.status` (`ticket_status` enum, 12 values),
- `tickets.lifecycle_status` (`ticket_lifecycle_status` enum, 6 values),
- `workflow_instances.workflow_status` (`text`, CHECK-constrained per `workflow_type`).

All three are written at ticket creation. None are updated thereafter, because no transition code exists. The state machines declared in [`docs/05_WORKFLOW_STATE_MACHINES.md`](../05_WORKFLOW_STATE_MACHINES.md) are reachable in the schema but unreachable from the application. `workflow_events` has zero rows in production.

The two enums for `tickets.status` and `tickets.lifecycle_status` are **not compatible**: `ticket_lifecycle_status` includes `open`, `escalated`, `resolved` which are not members of `ticket_status`. Any rule that synchronized the two columns would either silently reject writes or persist contradictory state.

Adjacent constraints:

- [ADR-003](./ADR-003-discord-ui-postgres-source.md) — Postgres is source of truth; Discord is UI.
- [ADR-011](./ADR-011-no-automatic-authority-mutation.md) — no automatic authority mutation.
- [ADR-014](./ADR-014-shadow-mode-first.md) — implementation prefers reversible, low-blast-radius rollout.
- Existing patterns to extend, not replace: `claimIdempotencyKey`/`completeIdempotencyKey`; the `OutboxEventType` union; the channel-marker dedup pattern in `apps/bot/src/safety.ts` (`getTicketChannelMarker`, `getStaleAlertMarker`).

## Decision

1. **`workflow_instances.workflow_status` is the single source of truth for ticket-domain progression.** All transition mutations target this column. The per-workflow state diagrams in `docs/05` apply to it and only to it.

2. **`tickets.lifecycle_status` is a derived projection** computed by the pure function `lifecycleFor(workflow_type, workflow_status)`. The transition service writes it in the same transaction as the workflow mutation. It answers "is the Discord case open or closed?" — never "what stage is this workflow in?" `lifecycleFor()` is **fail-closed**: defined only for enabled workflow types and their declared states. It never defaults to `open`. Non-enabled types reject at the workflow-type gate with `WORKFLOW_TYPE_NOT_IMPLEMENTED`; enabled types whose target state has no mapping reject with `LIFECYCLE_MAPPING_MISSING`. Both rejections are audited; neither mutates state.

3. **`tickets.status` is frozen.** After ticket creation it is never updated by any code path in this design. No synchronization rule with `lifecycle_status` exists, because the two enums are not compatible. Every row reads `status = 'submitted'` regardless of true workflow progress until a later schema slice backfills and/or drops the column.

4. **Every successful transition writes both a `workflow_events` row and an `audit_log` row** in a single database transaction with the state mutation. `workflow_events` is the per-workflow lineage; `audit_log` is the cross-cutting actor accountability surface. They are complementary, not redundant.

5. **Every rejected transition writes one `audit_log` row and zero `workflow_events` rows.** Rejected transitions did not happen to the workflow; they happened to the actor. This contradicts a sentence in `docs/05` (line ~52) and is recorded as a documentation-amendment item in §17 of the design doc; the contradiction is intentional.

6. **Transitions are idempotent through the existing `idempotency_keys` mechanism** under a new scope string `ticket:transition`. Replay returns the stored result; no double-write.

7. **Discord projection is delivered via a new outbox event type `ticket_transition`** added to the existing `OutboxEventType` union. No existing event type is repurposed.

8. **Outbox projection has a hard invariant and a defined retry policy.** For each `workflowEventId`, the projector produces **at most one** Discord transition message and **at most one** `discord_transition_projected` audit row. The deterministic in-channel marker `[ticket-transition:{workflowEventId}]` mirrors the existing `getTicketChannelMarker` / `getStaleAlertMarker` patterns and is one of two anchors the retry policy inspects (the other is the projection audit row). The three retry cases — marker present + audit present, marker present + audit missing, marker missing — each map to exactly one action (see §11 of the design). The implementation may pick the concrete uniqueness mechanism; the invariant is what must hold.

9. **Director paths are split into two distinct operations.** A `can_manage_config` actor performing a **director-authorized transition** (§12a) bypasses actor-capability and judgement constraints but follows the state-machine matrix, audited as `ticket_transition_applied` with `payload.directorOverride = true`. A `can_manage_config` actor performing an **explicit repair** (§12b) bypasses **only** the transition-edge matrix (`INVALID_TRANSITION`); it does **not** bypass `WORKFLOW_TYPE_NOT_IMPLEMENTED`, `WORKFLOW_INSTANCE_MISSING`, or `LIFECYCLE_MAPPING_MISSING`. Repair is permitted only for the first-implementation-slice workflows (`general`, `enlistment`) and only for targets with an approved `lifecycleFor()` mapping. Repair requires a non-empty `reason` and is audited as `ticket_transition_repair`. The two paths are queryable as distinct audit actions.

10. **Missing-channel response is fail-closed.** When `tickets.channel_id` does not resolve to a usable channel, the projector writes `ticket_transition_channel_missing` and marks the outbox row `failed` per standard backoff. It does **not** create a substitute channel. Automatic channel recreation is a later dedicated repair slice (§12c).

11. **`tickets.closed_at` represents the ticket's current terminal closure, not its historical close.** It is set when lifecycle enters `resolved`, preserved on `resolved → archived`, **cleared** when an explicit repair (§12b) returns lifecycle from `resolved`/`archived` to a non-terminal state, and re-set on subsequent re-resolution. Historical closure/reopening evidence remains in `workflow_events` and `audit_log`. The earlier draft's "never cleared" rule is rejected because it would make a reopened, active ticket appear closed.

12. **No ATCC code changes in the first transition implementation slice.** ATCC remains exactly as deployed. The existing `lifecycle_status` rendering naturally reflects transition writes. Workflow-status side-by-side display, a workflow-event read endpoint (`/api/tickets/:id/events`), and any operator-initiated transition action in ATCC are all deferred to a later read-only controls-display slice.

13. **Non-enabled workflows reject uniformly with `WORKFLOW_TYPE_NOT_IMPLEMENTED`.** `clearance`, `contract`, `intel`, `doctrine_challenge`, and `performance_evidence` are outside the first enabled subset (§3 of the design). Any transition request against them rejects with that single error code and is audited as a rejected attempt. `INVALID_TRANSITION` is reserved for disallowed state edges *within* enabled workflows only. This ADR does not decide whether `performance_evidence` will ever be implemented as a ticket-routed workflow, nor whether it should be removed from the enums. Evidence remains canonical in the `evidence` table per ADR-011; any future non-authoritative ticket mirror is a separate evidence/ticket integration decision and is **not** prejudged here.

## Consequences

**Positive:**

- One status surface (`workflow_status`) is authoritative. Future workflows extend a single declarative table.
- Every state change is auditable in two complementary surfaces — `workflow_events` for "what happened to this workflow" and `audit_log` for "what did this actor do".
- Existing idempotency, outbox, and channel-marker patterns are reused, not duplicated.
- The frozen-then-drop path for `tickets.status` is reversible: a later slice can drop or backfill the column without affecting authority.
- Director-authorized transition and explicit repair are queryable as distinct audit actions, supporting clean operator reporting.
- Fail-closed missing-channel response keeps the high-blast-radius channel-recreation question explicit and bounded to its own slice.

**Negative or with tradeoffs:**

- `tickets.status` will sit at `"submitted"` for every row until the deprecation slice runs. The existing controls Tickets UI renders `lifecycleStatus`, not `status`, so freezing the column does not misrepresent ticket state in the UI. The `listTickets()` DTO still exposes `status: row.status` for backward compatibility; no new consumer may interpret it as workflow meaning. DTO-field removal or explicit API deprecation is deferred to a later read-model cleanup slice alongside the column drop.
- Two indexes on `tickets.status` (`idx_tickets_guild_status`, `idx_tickets_type_status`) remain during the soak. Tolerable cost.
- A `workflow_instances` row is required for every ticket. `createTicket()` already does this; future code creating tickets must also create the workflow instance.
- `lifecycleFor()` must stay exhaustive over in-scope workflows. Type-checked exhaustiveness is required.
- The new outbox event type adds one entry to the union; downstream processors must handle (or explicitly ignore) `ticket_transition`.
- The marker-based dedup requires reading recent channel messages before each projection. This is the same cost model as the existing stale-alert dedup; acceptable.
- A rejected transition leaves no trace in `workflow_events`. Operators investigating "what did actor X try" must query `audit_log`, not `workflow_events`. This is documented in the design and intentional.

**Decisions explicitly deferred:**

- Whether `tickets.status` is backfilled, dropped, or kept indefinitely after the soak.
- Whether `performance_evidence` will ever be implemented as a ticket workflow, and whether/when it is removed from the enums.
- Whether ATCC will expose operator-initiated transitions in a future slice.
- Whether evidence validation should auto-archive an originating ticket (cross-domain integration; would require an evidence-to-ticket outbox event, not a direct service call).
- Implementation of `clearance`, `contract`, `intel`, `doctrine_challenge` workflow transitions. `clearance` is deferred specifically because it is authority-sensitive and requires live acceptance of the lower-authority workflows first. The transition-service interface admits all four without change.
- Automatic Discord channel recreation when `tickets.channel_id` is missing. Belongs to its own slice with permission/replay policy.
