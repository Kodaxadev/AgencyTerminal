# Operator Runbook

## Pre-launch checklist

- Create Discord application.
- Invite bot to test server.
- Configure Railway environment variables.
- Run migrations (001 through 007).
- Register guild commands.
- Configure role mappings.
- Configure queue channels.
- Configure audit channel.
- Configure metric point table.
- Configure retention policies.
- Submit test evidence (self and peer submission).
- Validate test evidence with quorum.
- Confirm score event creation.
- Confirm stale escalation.
- Confirm group credit (multiple subjects).
- Confirm evidence appeal flow.
- Confirm score reversal flow.
- Confirm score correction flow.
- Confirm ledger export.
- Confirm controls page health checks.
- Post operating doctrine to Discord.

## Daily operations

- Check the configured private ops queue channel for review cards and stale evidence.
- Check `#audit-log` for reversals, corrections, or overrides.
- Review pending enlistment/contract/intel cases.
- Check controls page for failed Discord projections.
- Review reviewer load metrics; rotate if overloaded.
- Export ledger weekly during early testing.

## Incident response

### If bot is down:

1. Check Railway deployment status.
2. Check latest crash logs.
3. Verify Discord token not rotated.
4. Verify database connection.
5. Restart Railway service.
6. Post manual notice in Discord if downtime affects reviews.

### If database migration fails:

1. Stop deployment.
2. Confirm migration checksum.
3. Restore from Supabase backup if necessary.
4. Re-run migrations in staging first.

### If score was incorrectly credited:

1. Do not edit database row manually.
2. Open reversal flow.
3. Require director + corroborating officer.
4. Record reason.
5. Post audit event.

### If reversal was incorrect:

1. Do not delete the reversal.
2. Open correction flow.
3. Create score_correction with reason.
4. If restoring, create new positive score_event.
5. Post audit event.

### If evidence needs backfill (bot was down):

1. Use `/evidence backfill` (requires `can_validate_evidence` or higher).
2. Provide: event_occurred_at, backfill_reason, source link/attachment.
3. Evidence enters review queue normally — backfill does not bypass quorum.

## Retention operations

```text
/agency retention show
/agency retention set ticket_transcript 365 archive
/agency retention set intel_sensitive 180 redact
/agency retention run-dry
/agency retention run
```

`run-dry` always shows affected counts before destructive action.

## Export commands

```text
/agency export ledger
/agency export tickets --since YYYY-MM-DD
/agency export audit --since YYYY-MM-DD
/agency export agent @agent
```

Exports include metadata: exportedAt, exportedBy, guildId, containsSensitiveData, retentionPolicyVersion.

## Health check reference

Controls page `/controls/health` checks:
- DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID present
- DATABASE_URL present
- SUPABASE storage configured
- Bot can read guild
- Bot can post to audit channel and ops queue
- Required DB migrations applied
- Background worker heartbeat fresh
- Outbox: 0 pending / 0 dead

Status language: `CODE 200 // OPERATIONAL`, `CODE 206 // DEGRADED`, `CODE 503 // ACTION REQUIRED`

## Soft launch monitoring

During shadow mode (Phase 1), track:
- Are metric point values reasonable?
- Are reviewers overloaded?
- Are evidence categories clear?
- Are group-credit flows practical?
- Are intel records too sensitive?
- Are appeals needed often?
- Are doctrine challenges useful or noisy?
- Does the bot reduce officer workload?

Pause rollout if: evidence queues stall, intel leaks occur, reviewers complain of overload, score disputes dominate usage, contract info leaks, bot permission drift causes private ticket exposure.
