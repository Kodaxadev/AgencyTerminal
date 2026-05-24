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
AGENCY_ALLOW_OPS_QUEUE_SETUP=false # development only; never enable for shadow/production
NODE_ENV=production
```

## Startup self-check

On boot, the bot should verify:

- Required environment variables exist.
- Discord token is valid.
- Target guild is reachable.
- Database connection succeeds.
- Required tables exist.
- Configured audit channels exist.
- Configured private ops queue exists and grants bot plus mapped reviewer-role access.
- Development setup mode is disabled in shadow/production.
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

## Soft launch policy

The bot launches in **shadow mode** before becoming authoritative:

### Phase 0 — Dry Run
- Test server or private channels
- Fake evidence, no real scoring

### Phase 1 — Shadow Ledger (2-4 weeks)
- Real evidence and reviews
- Officer-only profiles
- No authority impact
- Scores calculated but not authority-bearing

### Phase 2 — Advisory Ledger
- Profiles visible to members where safe
- Scores may inform discussion
- No automatic promotions

### Phase 3 — Operational Ledger
- Leadership may reference ledger in clearance/rank decisions
- Bot still does not auto-promote or auto-demote

### Exit criteria for shadow mode
- No critical schema changes pending
- Reviewers understand quorum process
- Stale escalation works
- Appeals process exists
- Score reversal process exists
- Public/officer profile split confirmed
- Retention/export policy accepted
- The Agency leadership accepts the social contract

### Failure criteria (pause rollout)
- Evidence queues stall
- Intel leaks occur
- Reviewers complain of overload
- Score disputes dominate usage
- Contract info leaks
- Bot permission drift causes private ticket exposure
