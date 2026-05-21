# 22 — Workflow State Machine Spec

## Purpose

The original schema used one flat `ticket_status` enum, but Agency Terminal has several workflow-specific state machines:

- Enlistment
- Contract
- Intel
- Evidence
- Clearance
- Doctrine Challenge
- General support

A single flat enum is ambiguous and either becomes too generic to be useful or too large to reason about.

## Decision

Tickets have a generic lifecycle, while each workflow has its own state.

```text
tickets.lifecycle_status = generic operational lifecycle
workflow_instances.workflow_status = workflow-specific state
```

This cleanly separates:

```text
Is the Discord case open/closed?
```

from:

```text
Where is this enlistment/contract/intel/evidence/doctrine workflow?
```

## Generic Ticket Lifecycle

```ts
type TicketLifecycleStatus =
  | "open"
  | "waiting_on_user"
  | "waiting_on_staff"
  | "escalated"
  | "resolved"
  | "archived";
```

This lifecycle is intentionally small. It tracks the container, not the domain workflow.

## Workflow Types

```ts
type WorkflowType =
  | "enlistment"
  | "contract"
  | "intel"
  | "performance_evidence"
  | "clearance"
  | "doctrine_challenge"
  | "general";
```

## Enlistment Workflow

```ts
type EnlistmentStatus =
  | "submitted"
  | "screening"
  | "interview"
  | "trial_agent"
  | "authorized"
  | "denied"
  | "archived";
```

Valid transitions:

```text
submitted -> screening
screening -> interview | denied
interview -> trial_agent | denied
trial_agent -> authorized | denied
authorized -> archived
denied -> archived
```

## Contract Workflow

```ts
type ContractStatus =
  | "intake"
  | "scoping"
  | "price_review"
  | "accepted"
  | "declined"
  | "active"
  | "completed"
  | "failed"
  | "paid"
  | "archived";
```

Valid transitions:

```text
intake -> scoping | declined
scoping -> price_review | declined
price_review -> accepted | declined
accepted -> active
active -> completed | failed
completed -> paid | archived
failed -> archived
paid -> archived
declined -> archived
```

## Intel Workflow

```ts
type IntelStatus =
  | "received"
  | "validating"
  | "corroborated"
  | "actionable"
  | "stale"
  | "false"
  | "exported"
  | "archived";
```

Valid transitions:

```text
received -> validating
validating -> corroborated | false | stale
corroborated -> actionable | exported | archived
actionable -> exported | archived
stale -> archived
false -> archived
exported -> archived
```

## Evidence Workflow

Evidence remains canonical in the `evidence` table. If a ticket is created for evidence, its workflow instance mirrors the evidence status for Discord UX only.

```ts
type EvidenceWorkflowStatus =
  | "submitted"
  | "under_review"
  | "stale_review"
  | "needs_more_evidence"
  | "validated"
  | "rejected"
  | "duplicate"
  | "credited"
  | "reversed"
  | "archived";
```

## Clearance Workflow

```ts
type ClearanceStatus =
  | "requested"
  | "reviewing"
  | "approved"
  | "denied"
  | "temporary"
  | "revoked"
  | "expired"
  | "archived";
```

## Doctrine Challenge Workflow

```ts
type DoctrineChallengeStatus =
  | "submitted"
  | "under_review"
  | "accepted_for_discussion"
  | "rejected_insufficient_evidence"
  | "adopted"
  | "deprecated"
  | "archived";
```

## General Workflow

```ts
type GeneralStatus =
  | "submitted"
  | "under_review"
  | "waiting_on_user"
  | "resolved"
  | "archived";
```

## Schema Model

Use a workflow instance table:

```ts
type WorkflowInstance = {
  id: string;
  ticketId: string;
  workflowType: WorkflowType;
  workflowStatus: string;
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
};
```

`workflow_status` is text with a check constraint enforced by `workflow_type`.

Why text instead of one enum per workflow?

- Easier migrations when one workflow evolves.
- Avoids a massive global enum.
- Keeps all workflow instances queryable in one table.
- Allows check constraints to enforce valid values.

## Transition Enforcement

Application code owns transition logic through pure functions:

```ts
canTransitionWorkflow(type, from, to): boolean
```

Database check constraints enforce valid status values, not transition order.

Transition attempts write `workflow_events`.

## Acceptance Criteria

- `tickets` no longer tries to represent every domain status.
- Workflow-specific states exist in `workflow_instances`.
- Invalid status values are rejected by database constraint.
- Invalid transitions are rejected by core logic.
- Evidence ticket status mirrors evidence ledger status but does not replace it.
