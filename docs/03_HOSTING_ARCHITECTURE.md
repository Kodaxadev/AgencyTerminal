# Hosting Architecture

## Recommended v1 stack

- Runtime: Railway long-running worker
- Database: Supabase Postgres
- Storage: Supabase Storage bucket for transcripts and evidence archives
- Dashboard: Vercel later
- Error tracking: Railway logs first, Sentry later

## Why Railway for bot runtime

Discord bots need a stable process to receive gateway events and handle interactions. Railway is simpler than Kubernetes and better suited than serverless functions for a persistent bot.

## Environment variables

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AGENCY_ADMIN_CHANNEL_ID=
AGENCY_AUDIT_CHANNEL_ID=
AGENCY_OPS_QUEUE_CHANNEL_ID=
NODE_ENV=production
```

## Startup self-check

On boot, the bot should verify:

- Required environment variables exist.
- Discord token is valid.
- Target guild is reachable.
- Database connection succeeds.
- Required tables exist.
- Configured queue/audit channels exist.
- Slash commands are registered.

## Background escalation loop

Every 15 minutes:

1. Find evidence in `under_review`.
2. Check age against timeout policy.
3. If timeout reached, set `stale_review`.
4. Post `[STALE — NEEDS RESOLUTION]` to ops queue.
5. Write audit event.

## v1 deployment topology

```text
Railway Project
  - service: agency-terminal-bot

Supabase Project
  - database: agency_terminal
  - storage bucket: agency-terminal-archives

Vercel Project later
  - app: agency-terminal-dashboard
```
