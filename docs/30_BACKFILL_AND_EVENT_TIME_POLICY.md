# 30 — Backfill and Event Time Policy

## Purpose

Agency Terminal may be unavailable during an operation, or the bot may be introduced after relevant Agency work already happened. The system must support backfill without weakening the ledger.

## Key Fields

Add:

```text
event_occurred_at
submitted_mode
backfill_reason
backfilled_by
```

## Submitted Modes

```ts
type SubmittedMode =
  | "live_bot"
  | "manual_backfill"
  | "imported";
```

## Field Semantics

```text
event_occurred_at
  When the contribution or incident actually happened.

created_at/submitted_at
  When the evidence was filed into Agency Terminal.

submitted_mode
  How the evidence entered the system.

backfill_reason
  Why evidence was filed after the fact.

backfilled_by
  Officer/operator who created the backfill, if applicable.
```

## Rules

### Live bot submission

Default path:

```text
submitted_mode = live_bot
event_occurred_at = user-provided or now
```

### Manual backfill

Used when:

```text
bot was unavailable
operation occurred before bot launch
old Discord thread needs ledger record
officer needs to credit a group after fleet/contract
```

Manual backfill requires:

```text
backfilled_by
backfill_reason
source link or attachment
event_occurred_at
```

### Imported

Reserved for future integration imports.

Imported evidence requires:

```text
source system
import timestamp
raw source reference
manual review before score credit
```

## Bot Downtime Policy

If Agency Terminal is down:

```text
Officers may accept manual Discord evidence.
A Handler or Director may backfill the evidence later.
Backfilled records must be visibly marked as backfilled.
Backfill does not bypass review or quorum.
```

## UX

Backfill command:

```text
/evidence backfill
```

Only available to:

```text
can_validate_evidence
can_manage_config
director-equivalent capability
```

Backfill embed:

```text
SIG//EVIDENCE BACKFILL
STATUS // CODE 202 // QUEUED FOR REVIEW

EVENT TIME: 2026-05-21 03:12 UTC
SUBMITTED MODE: MANUAL BACKFILL
BACKFILLED BY: @handler
REASON: Bot unavailable during fleet operation.
```

## Acceptance Criteria

- Evidence stores event time separately from submission time.
- Backfilled evidence is visibly marked.
- Backfill requires reason and actor.
- Backfill does not auto-credit.
- Imported evidence is reviewed before score credit.
