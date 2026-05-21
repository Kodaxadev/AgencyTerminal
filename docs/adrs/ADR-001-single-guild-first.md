# Adr 001 Single Guild First

## Status

Accepted for concept design.

## Decision

Agency Terminal is single-guild first, multi-guild-ready. All tables include guildId, but v1 deployment targets only The Agency server.

## Consequences

This keeps v1 operationally simple while preserving the auditability needed for doctrine-aligned contribution tracking.
