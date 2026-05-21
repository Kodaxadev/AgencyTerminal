# ADR-001 — Single Guild First

## Status

Accepted.

## Decision

Agency Terminal is single-guild first, multi-guild-ready. All tables include `guild_id`, but v1 deployment targets only The Agency server.

## Consequences

Keeps v1 operationally simple while preserving auditability. `guild_id` retained as technical safety, not SaaS positioning.
