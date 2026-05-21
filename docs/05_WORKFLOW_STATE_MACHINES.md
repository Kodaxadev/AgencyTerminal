# Workflow State Machines

## Purpose

Agency Terminal has several workflow-specific state machines. A generic ticket lifecycle tracks the Discord container (open/closed), while each workflow has its own domain-specific status.

```text
tickets.lifecycle_status = generic operational lifecycle
workflow_instances.workflow_status = workflow-specific state
```

This separates "Is the Discord case open/closed?" from "Where is this enlistment/contract/intel/evidence/doctrine workflow?"

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

Intentionally small. Tracks the container, not the domain workflow.

## Workflow Instances

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

`workflow_status` is text with a check constraint enforced by `workflow_type`. Using text instead of one enum per workflow allows:
- Easier migrations when one workflow evolves
- Avoids a massive global enum
- Keeps all workflow instances queryable in one table
- Allows check constraints to enforce valid values

Transition logic lives in application code through pure functions:
```ts
canTransitionWorkflow(type: WorkflowType, from: string, to: string): boolean
```

Database check constraints enforce valid status values, not transition order. Transition attempts write `workflow_events`.

## Enlistment Workflow

```text
submitted -> screening
screening -> interview | denied
interview -> trial_agent | denied
trial_agent -> authorized | denied
authorized -> archived
denied -> archived
```

Fields: Discord handle, EVE Frontier character name, timezone, primary discipline, prior EVE/PvP experience, contribution, critique handling, solo/small-gang/fleet preference, evidence links.

## Contract Workflow

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

Fields: Client name, client tribe/affiliation, contract type, target/system/route/objective, desired outcome, operational window, payment terms, risk level, public/private contract, evidence/intel provided, diplomatic sensitivity.

Contract details stored separately in `contract_details` table with retention tracking.

## Intel Workflow

```text
received -> validating
validating -> corroborated | false | stale
corroborated -> actionable | exported | archived
actionable -> exported | archived
stale -> archived
false -> archived
exported -> archived
```

Fields: System name, target character/tribe, smart object/gate/market/storage reference, threat type, observed activity, confidence level, evidence, source sensitivity, suggested action, Signal Vault export intent.

## Evidence Workflow

Evidence remains canonical in the `evidence` table. If a ticket is created for evidence, its workflow instance mirrors the evidence status for Discord UX only.

```text
submitted -> under_review -> validated | rejected | stale_review | needs_more_evidence | duplicate
validated -> credited -> archived
credited -> reversed (via score reversal flow)
```

Fields: Metric category, description, related operation, evidence link/screenshot, witnesses, character name, transaction digest / killboard link / API reference.

## Clearance Workflow

```text
requested -> reviewing -> approved | denied | temporary | expired
approved -> revoked | expired
denied -> archived
temporary -> approved | expired | revoked
revoked -> archived
expired -> archived
```

Fields: Requested clearance, reason, relevant contribution history, sponsor, operational need, duration, risk if denied, risk if granted.

## Doctrine Challenge Workflow

```text
submitted -> under_review -> accepted_for_discussion -> adopted | rejected_insufficient_evidence | deprecated
accepted_for_discussion -> adopted | rejected_insufficient_evidence | deprecated
adopted -> archived (generates Evidence Ledger credit)
rejected_insufficient_evidence -> archived
deprecated -> archived
```

Fields: Doctrine/tactic/policy/operation being challenged, claim, reasoning, evidence, alternative proposal, expected downside if ignored, urgency.

Adopted challenges generate Evidence Ledger credit.

## General Workflow

```text
submitted -> under_review -> waiting_on_user -> resolved | archived
under_review -> resolved | archived
```

For operational tickets that don't fit a specific workflow.

## Schema model

```text
tickets
  lifecycle_status: ticket_lifecycle_status  (open, waiting_on_user, etc.)
  short_id: text                             (TKT-NNNN, auto-generated)

workflow_instances
  ticket_id: uuid (unique, one per ticket)
  workflow_type: workflow_type
  workflow_status: text (check-constrained by type)
  status_reason: text

workflow_events
  workflow_instance_id: uuid
  actor_discord_id: text
  from_status: text
  to_status: text
  reason: text
  payload: jsonb

evidence
  short_id: text  (EVD-NNNN, auto-generated)
```

Short IDs are auto-assigned via database triggers for human-readable Discord/UI references. UUIDs remain canonical primary keys.
