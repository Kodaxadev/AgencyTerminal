# ADR-009 — Controls Page Is Internal Operator Console

## Status

Accepted.

## Decision

Agency Terminal includes a limited internal controls page for health, config, role mappings, evidence queues, audit, retention, and exports. It is not a public dashboard or user portal.

## Consequences

Controls page requires privileged auth (Discord OAuth2). Every mutation writes to `audit_log`. May be disabled by environment variable.
