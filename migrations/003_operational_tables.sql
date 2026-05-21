-- Agency Terminal operational tables.
-- Adds health checks, idempotency, rate limits, and Discord outbox support.

do $$ begin
  create type outbox_status as enum ('pending', 'processing', 'sent', 'failed', 'dead');
exception when duplicate_object then null;
end $$;

create table if not exists discord_outbox (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  event_type text not null,
  idempotency_key text not null,
  payload jsonb not null,
  status outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guild_id, idempotency_key)
);

create index if not exists idx_discord_outbox_due
on discord_outbox(status, next_attempt_at)
where status in ('pending', 'failed');

create table if not exists idempotency_keys (
  key text primary key,
  guild_id text not null references guild_config(guild_id) on delete cascade,
  scope text not null,
  actor_discord_id text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_idempotency_expires_at
on idempotency_keys(expires_at)
where expires_at is not null;

create table if not exists rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references guild_config(guild_id) on delete cascade,
  actor_discord_id text not null,
  action text not null,
  window_start timestamptz not null,
  window_seconds integer not null check (window_seconds > 0),
  count integer not null default 0 check (count >= 0),
  limit_count integer not null check (limit_count > 0),
  unique (guild_id, actor_discord_id, action, window_start)
);

create table if not exists bot_health_checks (
  id uuid primary key default gen_random_uuid(),
  guild_id text references guild_config(guild_id) on delete cascade,
  check_id text not null,
  status text not null check (status in ('ok', 'warn', 'fail')),
  detail text,
  remediation text,
  checked_at timestamptz not null default now(),
  unique (guild_id, check_id)
);

create table if not exists worker_heartbeats (
  worker_name text primary key,
  guild_id text references guild_config(guild_id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

drop trigger if exists trg_discord_outbox_updated_at on discord_outbox;
create trigger trg_discord_outbox_updated_at
before update on discord_outbox
for each row execute function set_updated_at();
