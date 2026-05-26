alter table guild_config
  add column if not exists admin_channel_id text;
