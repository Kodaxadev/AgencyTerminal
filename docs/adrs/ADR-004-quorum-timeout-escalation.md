# ADR-004 — Quorum Timeout Escalation

## Status

Accepted.

## Decision

Evidence validation uses quorum policies with timeout escalation (48h default) to prevent stalled reviews.

## Consequences

Stale reviews post to ops queue. Handler/Director may unblock with `director_override` and mandatory audit log.
