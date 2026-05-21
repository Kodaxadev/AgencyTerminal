# Implementation Roadmap

## Phase 0 — Planning and repo setup

Deliverables:
- PRD
- ADRs
- Schema (SQL migrations as canonical source)
- Bot skeleton
- CI checks

Acceptance gates:
```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
pnpm check:lines    # 400 line max per source file
pnpm verify:migrations
```

## Phase 1 — Evidence Ledger foundation

Deliverables:
- Database schema (migrations 001-007)
- Metric config
- Evidence records with short IDs
- Evidence subjects (group credit)
- Evidence witnesses
- Score events
- Reversal records
- Score corrections
- Audit log records
- Discord outbox table

Acceptance:
- Evidence can be submitted and stored with event_occurred_at.
- Evidence supports multiple credited subjects.
- Metric config supports point values and visibility.
- Score events are append-only.
- Reversals do not delete history.
- Corrections exist for mistaken reversals.

## Phase 2 — Discord intake

Deliverables:
- Slash commands
- Ticket creation with workflow instances
- Modals
- Private channels
- Short ID generation (TKT-NNNN, EVD-NNNN)
- Ticket event logging

## Phase 3 — Review and quorum

Deliverables:
- Reviewer actions with conflict disclosure
- Approval/objection records
- Evidence quality tier selection
- Quorum completion
- Timeout escalation loop
- Director override

## Phase 4 — Profiles and score views

Deliverables:
- `/profile @agent`
- `/profile @agent --full`
- Metric visibility gates
- Pending/reversed evidence view for officers
- Group credit summary

## Phase 5 — Workflow expansion

Deliverables:
- Enlistment protocol
- Contract intake with contract_details table
- Intel report with sensitivity controls
- Clearance request
- Doctrine Challenge with adoption credit

## Phase 6 — Appeals and corrections

Deliverables:
- `/evidence appeal` command
- Appeal review flow
- Score correction UI
- Appeal audit logging

## Phase 7 — Archives and export

Deliverables:
- Ticket transcripts
- Ledger export
- Evidence archive bucket
- Doctrine-change archive posts
- Retention export

## Phase 8 — Controls page

Deliverables:
- /controls health page
- /controls config management
- /controls role mappings
- /controls metrics table
- /controls evidence queues
- /controls audit log viewer
- /controls retention (dry-run + run)
- /controls exports
- Discord OAuth2 auth

## Phase 9 — Integrations later

Deliverables:
- Killboard URL enrichment (adapter)
- Signal Vault export (adapter)
- FrontierWarden lookup (adapter)
- World API references (adapter)

## Build tooling

Required commands:
```bash
pnpm install
pnpm typecheck          # tsc --noEmit
pnpm lint
pnpm test:run           # vitest run
pnpm build
pnpm check:lines        # scripts/check-lines.ts, 400 line max
pnpm verify:migrations  # psql against fresh DB
```

`check:lines` enforces 400 lines max per source file. Included: `apps/**/src/**/*.{ts,tsx}`, `packages/**/src/**/*.{ts,tsx}`, `scripts/**/*.ts`. Excluded: tests, generated, migrations.

## Test targets

### Core
- Evidence quorum
- Stale escalation
- Score credit idempotency
- Score reversal policy
- Score correction policy
- Metric visibility
- Permission checks
- Retention dry-run
- Group credit scoring
- Appeal workflow
- Backfill validation

### Bot
- Slash command registration
- Modal validation
- Button idempotency
- Permission denied responses
- Discord retry wrapper
- Workflow state transitions

### Controls
- Server-side permission checks
- Health page
- Role mapping update audit
- Metric config versioning
- Retention dry-run confirmation
- Dataset scoping per capability
