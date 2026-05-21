-- Agency Terminal retention and transcript support.
-- Retention policy is configurable per guild and per data class.
-- Evidence/score/audit records are retained longer than Discord workflow artifacts.

do $$ begin
  create type retention_class as enum (
    'ticket_channel',
    'ticket_transcript',
    'evidence_record',
    'evidence_attachment_copy',
    'audit_log',
    'score_event',
    'score_reversal',
    'intel_sensitive',
    'contract_terms',
    'doctrine_challenge'
  );
exception when duplicate_object then null;
end $$;

create table if not exists retention_policies (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  class retention_class not null,
  retain_days integer, -- null means indefinite/manual deletion only
  action text not null default 'retain' check (action in ('retain', 'archive', 'delete', 'redact')),
  sensitivity sensitivity_level not null default 'officer_only',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, class)
);

create table if not exists ticket_transcripts (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete restrict,
  guild_id text not null references guild_config(guild_id) on delete cascade,
  storage_url text not null,
  storage_provider text not null default 'supabase',
  sha256 text,
  message_count integer not null default 0 check (message_count >= 0),
  generated_by text,
  generated_at timestamptz not null default now(),
  retention_class retention_class not null default 'ticket_transcript',
  delete_after timestamptz
);

create index if not exists idx_ticket_transcripts_delete_after on ticket_transcripts(delete_after) where delete_after is not null;

create table if not exists evidence_attachment_copies (
  id uuid primary key default gen_random_uuid(),
  evidence_link_id uuid not null references evidence_links(id) on delete cascade,
  guild_id text not null references guild_config(guild_id) on delete cascade,
  source_url text not null,
  storage_url text not null,
  storage_provider text not null default 'supabase',
  sha256 text,
  copied_at timestamptz not null default now(),
  delete_after timestamptz
);

create index if not exists idx_evidence_attachment_copies_delete_after on evidence_attachment_copies(delete_after) where delete_after is not null;

drop trigger if exists trg_retention_policies_updated_at on retention_policies;
create trigger trg_retention_policies_updated_at
before update on retention_policies
for each row execute function set_updated_at();
