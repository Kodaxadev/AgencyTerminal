# 15 — Schema Implementation Spec

## Purpose

The earlier design suite defined TypeScript shapes but did not include canonical migration files. This patch adds SQL migrations and a Drizzle schema sketch.

## Canonical Source

For MVP, use SQL migrations as the canonical schema source:

```text
migrations/
  001_initial_agency_terminal.sql
  002_retention_and_transcripts.sql
```

The Drizzle file is provided as an implementation sketch:

```text
schema/drizzle-schema.ts
```

If the repo chooses Prisma instead of Drizzle, generate Prisma models from the SQL concepts rather than treating the existing Drizzle sketch as binding.

## Required Tables

### Configuration

```text
guild_config
role_mappings
metric_config
retention_policies
```

### Ticket workflow

```text
tickets
ticket_participants
ticket_events
ticket_transcripts
```

### Evidence Ledger

```text
evidence
evidence_links
evidence_reviews
evidence_attachment_copies
```

### Scoring

```text
agent_score_events
score_reversals
```

### Specialized flows

```text
doctrine_challenges
clearance_requests
```

### Governance

```text
audit_log
```

## Critical Invariants

1. Scores are append-only.
2. Score correction happens through `score_reversals`.
3. Evidence status may progress, but historical reviews remain.
4. Audit rows are never edited by normal application code.
5. Ticket channels may disappear; ticket records must remain.
6. Evidence may exist without a live Discord ticket channel.
7. Metric config is versioned so historical score events retain meaning.

## Recommended Migration Commands

For a simple SQL migration runner:

```bash
psql "$DATABASE_URL" -f migrations/001_initial_agency_terminal.sql
psql "$DATABASE_URL" -f migrations/002_retention_and_transcripts.sql
```

For Drizzle:

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

Then either:

```bash
pnpm drizzle-kit introspect
```

or convert the SQL migrations into generated Drizzle migrations after the schema stabilizes.

## Test Fixtures

Minimum seed data:

```sql
insert into guild_config (guild_id, name)
values ('test-guild', 'Agency Terminal Test')
on conflict do nothing;

insert into metric_config (guild_id, category, base_points, visibility, version)
values
('test-guild', 'pvp_kill_value', 5, 'public', 1),
('test-guild', 'fleet_participation', 2, 'public', 1),
('test-guild', 'contracts_completed', 8, 'public', 1),
('test-guild', 'intelligence_acquisitions', 6, 'officer_only', 1),
('test-guild', 'technical_development_output', 10, 'officer_only', 1),
('test-guild', 'asset_contributions', 4, 'officer_only', 1),
('test-guild', 'exploration', 3, 'public', 1),
('test-guild', 'lore_discovery', 3, 'public', 1);
```

## Acceptance Criteria

- Fresh database can apply both migrations without manual edits.
- All ticket and evidence tables include `guild_id`.
- Score reversal cannot exist without a score event.
- Duplicate reviewer decision for the same evidence is prevented.
- Duplicate reversal for the same score event is prevented.
- Metric config supports versioning.
- Retention policy supports indefinite records.
