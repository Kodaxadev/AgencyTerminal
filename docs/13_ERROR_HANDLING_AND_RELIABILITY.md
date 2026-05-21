# 13 — Error Handling and Reliability

## Purpose

Agency Terminal is a Discord workflow surface backed by a governance ledger. Discord API failures must not corrupt ledger state, double-credit evidence, or silently drop officer actions.

## Reliability Principle

Database writes and Discord UI updates must be treated as separate reliability domains.

- Postgres is the source of truth.
- Discord messages are projections of that truth.
- A failed Discord message update should create a retryable outbox event, not roll back the ledger by default.
- A failed ledger write must stop the user-facing workflow and report the failure.

## Failure Classes

| Failure | Example | Strategy |
|---|---|---|
| Discord rate limit | HTTP 429 | Respect `retry_after`, exponential backoff with jitter |
| Discord transient server error | HTTP 500/502/503/504 | Retry with backoff |
| Discord permission error | HTTP 403 | Do not retry blindly; mark config unhealthy |
| Discord missing resource | HTTP 404 channel/message missing | Mark projection stale; alert ops |
| Database conflict | duplicate review, duplicate score reversal | Return deterministic user response |
| Database unavailable | connection timeout | Fail closed; do not fake success |
| Storage failure | transcript upload fails | Keep ticket close pending or mark transcript_failed |
| Background job crash | stale review scan fails | Log error and continue next cycle |

## Discord Retry Policy

Use a shared `discordRequest()` wrapper for all non-idempotent Discord actions.

Default policy:

```ts
type RetryPolicy = {
  maxAttempts: 5;
  baseDelayMs: 500;
  maxDelayMs: 30_000;
  jitter: true;
  retryOnStatus: [429, 500, 502, 503, 504];
  failFastOnStatus: [401, 403, 404];
};
```

Backoff formula:

```ts
delay = min(maxDelayMs, baseDelayMs * 2 ** attempt) + random(0, 250)
```

For HTTP 429, Discord's returned retry delay overrides the computed delay.

## Idempotency Rules

Every state-changing action must have a deterministic idempotency key.

Examples:

| Action | Idempotency key |
|---|---|
| Create ticket | `ticket:create:{guildId}:{interactionId}` |
| Add evidence review | `review:{evidenceId}:{reviewerDiscordId}` |
| Credit score | `score:credit:{evidenceId}:{agentDiscordId}` |
| Reverse score | `score:reverse:{scoreEventId}` |
| Post stale alert | `stale-alert:{evidenceId}` |
| Export transcript | `transcript:{ticketId}` |

## Transaction Boundary

For validation and score crediting:

```text
1. Begin DB transaction
2. Insert evidence review
3. Recalculate quorum
4. If quorum reached, update evidence status
5. Insert agent_score_event if applicable
6. Insert audit_log row
7. Insert Discord outbox event
8. Commit
9. Process outbox event asynchronously
```

This prevents Discord update failures from corrupting the ledger.

## Outbox Table Recommendation

Add in a later migration if needed:

```sql
create table discord_outbox (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

MVP may implement this in memory, but production should persist it.

## User-Facing Failure Language

Use Agency-style embeds.

```text
SIG//AGENCY TERMINAL
STATUS // CODE 503 // TEMPORARY FAILURE

The ledger was not updated.
Action may be retried safely.
```

For permission/config errors:

```text
SIG//AGENCY TERMINAL
STATUS // CODE 403 // CONFIGURATION REJECTED

The bot lacks permission to update the target channel.
Notify a Handler or Director.
```

## Background Job Failure Policy

The stale-review escalation job must be safe to run repeatedly.

Rules:

- Never create duplicate stale alerts.
- Use `stale_notified_at` to lock notification state.
- Continue processing other evidence if one item fails.
- Emit structured logs for every failure.

## Minimum Structured Log Fields

```json
{
  "event": "discord_request_failed",
  "guildId": "...",
  "action": "post_audit_embed",
  "status": 503,
  "attempt": 3,
  "willRetry": true
}
```

## Acceptance Criteria

- Discord HTTP 429 is retried using Discord's retry delay.
- 500-class errors retry with exponential backoff.
- 403/404 errors do not loop indefinitely.
- Score credit cannot be duplicated by repeated button clicks.
- Score reversal cannot be duplicated by repeated button clicks.
- Stale-review alerts cannot be duplicated by repeated background runs.
- Failed Discord projection does not silently imply failed ledger state.
