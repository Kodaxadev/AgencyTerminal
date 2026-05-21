# ADR-003 — Discord Is UI, Postgres Is Source

## Status

Accepted.

## Decision

Discord is workflow UI. Postgres is source of truth for tickets, evidence, score events, reversals, appeals, and audit logs.

## Consequences

Discord messages are projections. Failed Discord UI updates create retryable outbox events, not ledger rollbacks.
