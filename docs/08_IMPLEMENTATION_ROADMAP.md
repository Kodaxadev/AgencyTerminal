# Implementation Roadmap

## Phase 0 — Planning and repo setup

Deliverables:

- PRD
- ADRs
- Schema draft
- Bot skeleton
- CI checks

Acceptance gates:

```text
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm check:lines
```

## Phase 1 — Evidence Ledger foundation

Deliverables:

- Database schema
- Metric config
- Evidence records
- Score events
- Reversal records
- Audit log records

Acceptance:

- Evidence can be submitted and stored.
- Metric config supports point values and visibility.
- Score events are append-only.
- Reversals do not delete history.

## Phase 2 — Discord intake

Deliverables:

- Slash commands
- Ticket creation
- Modals
- Private channels
- Ticket event logging

## Phase 3 — Review and quorum

Deliverables:

- Reviewer actions
- Approval/objection records
- Quorum completion
- Timeout escalation loop
- Director override

## Phase 4 — Profiles and score views

Deliverables:

- `/profile @agent`
- `/profile @agent --full`
- Metric visibility gates
- Pending/reversed evidence view for officers

## Phase 5 — Workflow expansion

Deliverables:

- Enlistment
- Contract
- Intel
- Clearance
- Doctrine Challenge

## Phase 6 — Archives and export

Deliverables:

- Ticket transcripts
- Ledger export
- Evidence archive bucket
- Doctrine-change archive posts

## Phase 7 — Integrations later

Deliverables:

- Killboard URL enrichment
- Signal Vault export
- FrontierWarden lookup
- World API references
