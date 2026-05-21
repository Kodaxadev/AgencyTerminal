# Adr 003 Discord Ui Postgres Source

## Status

Accepted for concept design.

## Decision

Discord is workflow UI. Postgres is source of truth for tickets, evidence, score events, reversals, and audit logs.

## Consequences

This keeps v1 operationally simple while preserving the auditability needed for doctrine-aligned contribution tracking.
