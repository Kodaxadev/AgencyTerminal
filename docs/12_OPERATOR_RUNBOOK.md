# Operator Runbook

## Pre-launch checklist

- Create Discord application.
- Invite bot to test server.
- Configure Railway environment variables.
- Run migrations.
- Register guild commands.
- Configure role mappings.
- Configure queue channels.
- Configure audit channel.
- Configure metric point table.
- Submit test evidence.
- Validate test evidence.
- Confirm score event creation.
- Confirm stale escalation.
- Confirm ledger export.

## Daily operations

- Check `#ops-queue` for stale evidence.
- Check `#audit-log` for reversals or overrides.
- Review pending enlistment/contract/intel cases.
- Export ledger weekly during early testing.

## Incident response

If bot is down:

1. Check Railway deployment status.
2. Check latest crash logs.
3. Verify Discord token not rotated.
4. Verify database connection.
5. Restart Railway service.
6. Post manual notice in Discord if downtime affects reviews.

If database migration fails:

1. Stop deployment.
2. Confirm migration checksum.
3. Restore from Supabase backup if necessary.
4. Re-run migrations in staging first.

If score was incorrectly credited:

1. Do not edit database row manually.
2. Open reversal flow.
3. Require director + corroborating officer.
4. Record reason.
5. Post audit event.
