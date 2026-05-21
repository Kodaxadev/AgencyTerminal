# Changelog

## Unreleased

### Added
- Workflow state machine spec (lifecycle vs workflow status split).
- Group credit and witness model (evidence_subjects, evidence_witnesses).
- Appeals workflow for rejected/incorrect evidence.
- Score correction path for mistaken reversals.
- Backfill and event time policy (live_bot, manual_backfill, imported).
- Evidence quality tiers (A/B/C/D/F).
- Controls page spec with page-scoped and dataset-scoped access.
- Counterintelligence policy for intel, contracts, and sensitive data.
- Operating doctrine (social contract for Agency Terminal).
- Red-team checklist for pre-launch review.
- Soft launch policy with shadow mode phases.
- Reviewer load and conflict disclosure model.
- Negative evidence boundary (no negative public score in v1).
- Short IDs for tickets (TKT-NNNN) and evidence (EVD-NNNN).
- Contract details table for retention tracking.
- Operational tables (discord_outbox, idempotency_keys, rate_limit_buckets, bot_health_checks, worker_heartbeats).
- Build tooling spec (check:lines implementation).

### Changed
- Ticket lifecycle separated from workflow status (generic lifecycle + workflow-specific state machines).
- Evidence supports multiple credited subjects per record.
- Score reversals are never deleted; corrections provide the correction path.
- Controls page access is page-scoped and dataset-scoped, not blanket officer access.
- Intel and contract data default to officer_only visibility.

### Removed
- SaaS/platform language and assumptions.
- Flat ticket_status enum ambiguity.
- Patch delivery artifacts from /docs.
