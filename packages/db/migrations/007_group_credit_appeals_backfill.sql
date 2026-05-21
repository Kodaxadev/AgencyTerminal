-- Agency Terminal Pack 04 migration.
-- Adds group credit, witnesses, appeals, event time, backfill, conflict disclosure,
-- and evidence quality tiers.

do $$ begin
  create type evidence_subject_role as enum (
    'primary',
    'supporting',
    'witness_only'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type evidence_witness_type as enum (
    'participant',
    'observer',
    'officer',
    'external_source'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type submitted_mode as enum (
    'live_bot',
    'manual_backfill',
    'imported'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type appeal_status as enum (
    'requested',
    'under_review',
    'granted',
    'denied',
    'final'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type appeal_ground as enum (
    'new_evidence',
    'procedural_error',
    'wrong_subject',
    'wrong_metric',
    'wrong_points',
    'duplicate_error',
    'reversal_error'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type evidence_quality_tier as enum ('A', 'B', 'C', 'D', 'F');
exception when duplicate_object then null;
end $$;

alter table evidence
add column if not exists event_occurred_at timestamptz,
add column if not exists submitted_mode submitted_mode not null default 'live_bot',
add column if not exists backfill_reason text,
add column if not exists backfilled_by text,
add column if not exists quality_tier evidence_quality_tier;

create table if not exists evidence_subjects (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  subject_discord_id text not null,
  role evidence_subject_role not null default 'primary',
  point_multiplier numeric(6, 3) not null default 1.0 check (point_multiplier >= 0),
  note text,
  created_at timestamptz not null default now(),
  unique (evidence_id, subject_discord_id)
);

create index if not exists idx_evidence_subjects_subject
on evidence_subjects(subject_discord_id);

create index if not exists idx_evidence_subjects_evidence
on evidence_subjects(evidence_id);

create table if not exists evidence_witnesses (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  witness_discord_id text,
  witness_type evidence_witness_type not null default 'participant',
  statement text,
  external_reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_witnesses_evidence
on evidence_witnesses(evidence_id);

create table if not exists evidence_appeals (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  requested_by text not null,
  status appeal_status not null default 'requested',
  ground appeal_ground not null,
  explanation text not null check (length(explanation) >= 12),
  requested_outcome text not null,
  reviewer_discord_id text,
  outcome_reason text,
  final boolean not null default false,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_evidence_appeals_evidence
on evidence_appeals(evidence_id);

create index if not exists idx_evidence_appeals_status
on evidence_appeals(status);

alter table evidence_reviews
add column if not exists conflict_disclosed boolean not null default false,
add column if not exists conflict_reason text;

-- Capability additions for appeals/backfill if not already present.
alter type capability add value if not exists 'can_backfill_evidence';
alter type capability add value if not exists 'can_review_appeals';

-- Optional operational invariant:
-- Backfilled evidence should have a reason and backfilled_by.
-- Kept as NOT VALID first so existing data can be migrated safely.
do $$ begin
  alter table evidence add constraint evidence_backfill_requires_reason check (
    submitted_mode <> 'manual_backfill'
    or (backfill_reason is not null and length(backfill_reason) >= 12 and backfilled_by is not null)
  ) not valid;
exception when duplicate_object then null;
end $$;
