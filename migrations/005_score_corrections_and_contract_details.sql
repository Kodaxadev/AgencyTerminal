-- Agency Terminal score correction and contract details patch.
-- Adds a correction path for mistaken reversals and a concrete place for contract terms.

do $$ begin
  create type score_correction_type as enum (
    'restore_reversed_score',
    'adjust_score_after_review'
  );
exception when duplicate_object then null;
end $$;

create table if not exists score_corrections (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  score_event_id uuid not null references agent_score_events(id) on delete restrict,
  reversal_id uuid references score_reversals(id) on delete restrict,
  correction_type score_correction_type not null,
  requested_by text not null,
  corroborated_by text not null,
  reason text not null check (length(reason) >= 12),
  restored_score_event_id uuid references agent_score_events(id) on delete restrict,
  audit_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_score_corrections_score_event
on score_corrections(score_event_id);

create table if not exists contract_details (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  guild_id text not null references guild_config(guild_id) on delete cascade,
  client_name text,
  client_affiliation text,
  objective text not null default '',
  operational_window text,
  payment_terms text,
  risk_level priority_level not null default 'medium',
  diplomatic_sensitivity sensitivity_level not null default 'officer_only',
  retention_class retention_class not null default 'contract_terms',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id)
);

drop trigger if exists trg_contract_details_updated_at on contract_details;
create trigger trg_contract_details_updated_at
before update on contract_details
for each row execute function set_updated_at();
