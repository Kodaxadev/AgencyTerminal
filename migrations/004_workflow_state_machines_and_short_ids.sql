-- Agency Terminal workflow state machine patch.
-- Resolves flat ticket_status ambiguity by splitting generic ticket lifecycle
-- from workflow-specific status.

do $$ begin
  create type ticket_lifecycle_status as enum (
    'open',
    'waiting_on_user',
    'waiting_on_staff',
    'escalated',
    'resolved',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type workflow_type as enum (
    'enlistment',
    'contract',
    'intel',
    'performance_evidence',
    'clearance',
    'doctrine_challenge',
    'general'
  );
exception when duplicate_object then null;
end $$;

-- Keep old tickets.status for compatibility if already applied, but introduce
-- the cleaner lifecycle field. New code should use lifecycle_status.
alter table tickets
add column if not exists lifecycle_status ticket_lifecycle_status not null default 'open';

-- Human-readable short IDs for Discord/UI references.
-- UUID remains canonical primary key.
alter table tickets
add column if not exists short_id text;

alter table evidence
add column if not exists short_id text;

create sequence if not exists ticket_short_id_seq;
create sequence if not exists evidence_short_id_seq;

create or replace function assign_ticket_short_id()
returns trigger as $$
begin
  if new.short_id is null then
    new.short_id := 'TKT-' || lpad(nextval('ticket_short_id_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function assign_evidence_short_id()
returns trigger as $$
begin
  if new.short_id is null then
    new.short_id := 'EVD-' || lpad(nextval('evidence_short_id_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assign_ticket_short_id on tickets;
create trigger trg_assign_ticket_short_id
before insert on tickets
for each row execute function assign_ticket_short_id();

drop trigger if exists trg_assign_evidence_short_id on evidence;
create trigger trg_assign_evidence_short_id
before insert on evidence
for each row execute function assign_evidence_short_id();

create unique index if not exists idx_tickets_guild_short_id
on tickets(guild_id, short_id)
where short_id is not null;

create unique index if not exists idx_evidence_guild_short_id
on evidence(guild_id, short_id)
where short_id is not null;

create table if not exists workflow_instances (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  workflow_type workflow_type not null,
  workflow_status text not null,
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id),
  constraint workflow_status_valid check (
    (workflow_type = 'enlistment' and workflow_status in (
      'submitted', 'screening', 'interview', 'trial_agent', 'authorized', 'denied', 'archived'
    ))
    or
    (workflow_type = 'contract' and workflow_status in (
      'intake', 'scoping', 'price_review', 'accepted', 'declined', 'active', 'completed', 'failed', 'paid', 'archived'
    ))
    or
    (workflow_type = 'intel' and workflow_status in (
      'received', 'validating', 'corroborated', 'actionable', 'stale', 'false', 'exported', 'archived'
    ))
    or
    (workflow_type = 'performance_evidence' and workflow_status in (
      'submitted', 'under_review', 'stale_review', 'needs_more_evidence', 'validated', 'rejected', 'duplicate', 'credited', 'reversed', 'archived'
    ))
    or
    (workflow_type = 'clearance' and workflow_status in (
      'requested', 'reviewing', 'approved', 'denied', 'temporary', 'revoked', 'expired', 'archived'
    ))
    or
    (workflow_type = 'doctrine_challenge' and workflow_status in (
      'submitted', 'under_review', 'accepted_for_discussion', 'rejected_insufficient_evidence', 'adopted', 'deprecated', 'archived'
    ))
    or
    (workflow_type = 'general' and workflow_status in (
      'submitted', 'under_review', 'waiting_on_user', 'resolved', 'archived'
    ))
  )
);

create index if not exists idx_workflow_instances_type_status
on workflow_instances(workflow_type, workflow_status);

create table if not exists workflow_events (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references workflow_instances(id) on delete cascade,
  actor_discord_id text,
  from_status text,
  to_status text not null,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_workflow_events_instance_created
on workflow_events(workflow_instance_id, created_at);

drop trigger if exists trg_workflow_instances_updated_at on workflow_instances;
create trigger trg_workflow_instances_updated_at
before update on workflow_instances
for each row execute function set_updated_at();
