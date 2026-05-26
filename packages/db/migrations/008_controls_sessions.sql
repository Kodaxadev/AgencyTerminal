create table if not exists controls_sessions (
  id text primary key,
  guild_id text not null,
  "user" jsonb not null default '{}'::jsonb,
  discord_role_ids jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_controls_sessions_expires_at
  on controls_sessions (expires_at);
