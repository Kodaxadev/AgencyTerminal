-- Agency Terminal initial schema
-- PostgreSQL / Supabase-compatible baseline.
-- Design principle: Discord is workflow UI; Postgres is the source of truth.
-- Scores are append-only events. Reversals are explicit records.

create extension if not exists "pgcrypto";

-- ---------- Enums ----------

do $$ begin
  create type ticket_type as enum (
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

do $$ begin
  create type ticket_status as enum (
    'submitted',
    'screening',
    'under_review',
    'waiting_on_user',
    'waiting_on_staff',
    'accepted',
    'denied',
    'validated',
    'rejected',
    'active',
    'completed',
    'archived'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type priority_level as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type sensitivity_level as enum ('public', 'member', 'officer_only', 'director_only');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type metric_category as enum (
    'pvp_kill_value',
    'fleet_participation',
    'contracts_completed',
    'intelligence_acquisitions',
    'technical_development_output',
    'asset_contributions',
    'exploration',
    'lore_discovery'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type metric_visibility as enum ('public', 'officer_only');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type evidence_status as enum (
    'submitted',
    'under_review',
    'stale_review',
    'needs_more_evidence',
    'validated',
    'rejected',
    'duplicate',
    'credited',
    'reversed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type review_decision as enum ('approve', 'object', 'needs_more_evidence');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type score_status as enum ('credited', 'reversed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type point_source as enum ('configured_table', 'director_override', 'manual_adjustment');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type capability as enum (
    'can_view_all_tickets',
    'can_validate_evidence',
    'can_override_quorum',
    'can_reverse_score',
    'can_manage_clearance',
    'can_manage_contracts',
    'can_manage_intel',
    'can_manage_config'
  );
exception when duplicate_object then null;
end $$;

-- ---------- Guild configuration ----------

create table if not exists guild_config (
  guild_id text primary key,
  name text not null default 'Agency Terminal',
  audit_channel_id text,
  ops_queue_channel_id text,
  archive_channel_id text,
  doctrine_changes_channel_id text,
  stale_review_hours integer not null default 48 check (stale_review_hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists role_mappings (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  capability capability not null,
  discord_role_id text not null,
  created_at timestamptz not null default now(),
  unique (guild_id, capability, discord_role_id)
);

create table if not exists metric_config (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  category metric_category not null,
  base_points integer not null default 1 check (base_points >= 0),
  visibility metric_visibility not null default 'public',
  enabled boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, category, version)
);

-- ---------- Ticket system ----------

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  channel_id text not null unique,
  creator_discord_id text not null,
  assigned_discord_id text,
  type ticket_type not null,
  status ticket_status not null default 'submitted',
  priority priority_level not null default 'medium',
  sensitivity sensitivity_level not null default 'member',
  title text not null,
  summary text not null default '',
  character_name text,
  wallet_address text,
  tribe_name text,
  system_name text,
  smart_object_id text,
  target_name text,
  target_tribe text,
  contract_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists idx_tickets_guild_status on tickets(guild_id, status);
create index if not exists idx_tickets_type_status on tickets(type, status);

create table if not exists ticket_participants (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  discord_id text not null,
  role text not null default 'participant',
  added_by text,
  created_at timestamptz not null default now(),
  unique (ticket_id, discord_id)
);

create table if not exists ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  actor_discord_id text,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_events_ticket_created on ticket_events(ticket_id, created_at);

-- ---------- Evidence ledger ----------

create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  ticket_id uuid references tickets(id) on delete set null,
  submitted_by_discord_id text not null,
  subject_discord_id text,
  metric_category metric_category not null,
  status evidence_status not null default 'submitted',
  sensitivity sensitivity_level not null default 'member',
  title text not null,
  description text not null default '',
  validation_required_approvals integer not null default 2 check (validation_required_approvals > 0),
  stale_after timestamptz,
  stale_notified_at timestamptz,
  validated_at timestamptz,
  rejected_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_evidence_guild_status on evidence(guild_id, status);
create index if not exists idx_evidence_stale on evidence(status, stale_after) where status = 'under_review';

create table if not exists evidence_links (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  url text not null,
  source_type text not null check (source_type in (
    'killboard',
    'screenshot',
    'discord_message',
    'transaction_digest',
    'world_api',
    'manual',
    'signal_vault'
  )),
  parsed boolean not null default false,
  parsed_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists evidence_reviews (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references evidence(id) on delete cascade,
  reviewer_discord_id text not null,
  decision review_decision not null,
  rationale text not null default '',
  created_at timestamptz not null default now(),
  unique (evidence_id, reviewer_discord_id)
);

create index if not exists idx_evidence_reviews_evidence on evidence_reviews(evidence_id);

-- ---------- Score events and reversals ----------

create table if not exists agent_score_events (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  evidence_id uuid not null references evidence(id) on delete restrict,
  agent_discord_id text not null,
  character_name text,
  wallet_address text,
  metric_category metric_category not null,
  point_source point_source not null default 'configured_table',
  points_approved integer not null check (points_approved >= 0),
  points_table_version integer not null default 1 check (points_table_version > 0),
  credited_by text not null,
  credited_at timestamptz not null default now(),
  status score_status not null default 'credited',
  reversal_reason text
);

create index if not exists idx_agent_score_events_agent on agent_score_events(guild_id, agent_discord_id);
create index if not exists idx_agent_score_events_metric on agent_score_events(guild_id, metric_category);

create table if not exists score_reversals (
  id uuid primary key default gen_random_uuid(),
  score_event_id uuid not null references agent_score_events(id) on delete restrict,
  requested_by text not null,
  corroborated_by text not null,
  reason text not null check (length(reason) >= 12),
  evidence_url text,
  audit_message_id text,
  created_at timestamptz not null default now(),
  unique (score_event_id)
);

-- ---------- Doctrine and clearance ----------

create table if not exists doctrine_challenges (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete set null,
  submitted_by_discord_id text not null,
  title text not null,
  challenge_summary text not null,
  proposed_revision text not null,
  status text not null default 'submitted' check (status in (
    'submitted',
    'under_review',
    'accepted_for_discussion',
    'rejected_insufficient_evidence',
    'adopted',
    'deprecated',
    'archived'
  )),
  adopted_score_event_id uuid references agent_score_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clearance_requests (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete set null,
  requester_discord_id text not null,
  requested_clearance text not null,
  reason text not null,
  status text not null default 'requested' check (status in (
    'requested',
    'reviewing',
    'approved',
    'denied',
    'temporary',
    'revoked',
    'expired'
  )),
  decided_by text,
  decided_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Audit log ----------

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  actor_discord_id text,
  action text not null,
  subject_type text not null,
  subject_id text not null,
  sensitivity sensitivity_level not null default 'officer_only',
  payload jsonb not null default '{}'::jsonb,
  discord_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_guild_created on audit_log(guild_id, created_at desc);
create index if not exists idx_audit_subject on audit_log(subject_type, subject_id);

-- ---------- Updated-at helper ----------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_guild_config_updated_at on guild_config;
create trigger trg_guild_config_updated_at
before update on guild_config
for each row execute function set_updated_at();

drop trigger if exists trg_metric_config_updated_at on metric_config;
create trigger trg_metric_config_updated_at
before update on metric_config
for each row execute function set_updated_at();

drop trigger if exists trg_tickets_updated_at on tickets;
create trigger trg_tickets_updated_at
before update on tickets
for each row execute function set_updated_at();

drop trigger if exists trg_evidence_updated_at on evidence;
create trigger trg_evidence_updated_at
before update on evidence
for each row execute function set_updated_at();

drop trigger if exists trg_doctrine_challenges_updated_at on doctrine_challenges;
create trigger trg_doctrine_challenges_updated_at
before update on doctrine_challenges
for each row execute function set_updated_at();
