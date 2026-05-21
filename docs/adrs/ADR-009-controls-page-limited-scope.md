# ADR-009 — Controls Page Is an Internal Operator Console

## Status

Accepted.

## Context

Some actions are awkward in Discord: retention, exports, role mapping, health checks, and stuck evidence review.

## Decision

Agency Terminal will include a limited internal controls page. It is not a public dashboard or user portal.

## Consequences

- Controls page requires privileged auth.
- Every mutation writes to audit_log.
- Controls page may be disabled by environment variable.
- Discord remains the primary workflow UI.
