# ADR-016: Controls Containment Hardening

Date: 2026-05-26

## Status

Accepted

## Context

ATCC controls is moving toward a managed Agency shadow pilot. The controls
surface can administer guild configuration, role mappings, metrics, retention
policy, and exports. Those actions are authority-adjacent even while the product
remains shadow/advisory.

The security policy requires server-side capability checks, explicit
confirmation for sensitive actions, audit records for mutations, session role
rechecks, and guarded sensitive exports. See
`docs/09_SECURITY_PRIVACY_COUNTERINTEL.md`.

## Decision

Controls must fail closed unless `CONTROLS_ENABLED=true` is explicitly set.

Unsafe API methods must pass same-origin validation before auth/session logic
or mutating handlers run. Production requests without an origin are rejected.
The server compares the request origin to `CONTROLS_PUBLIC_BASE_URL` when set,
falling back to forwarded host/proto only when needed.

Protected mutations use the existing `rate_limit_buckets` table for per-guild,
per-actor, per-action fixed-window throttling. The default limit is 20
mutations per minute and can be lowered or raised with
`CONTROLS_MUTATION_LIMIT_PER_MINUTE`.

Controls JSON request bodies are capped at 64 KiB.

New persisted Discord OAuth session tokens are encrypted before writing to
`controls_sessions`. Existing plaintext session rows remain readable only for
backward compatibility until their normal session expiry.

Config, role-mapping, metric-version, and retention-policy mutations write the
state change and matching `audit_log` row in one database transaction.

Controls exports redact high-risk free-text, payload, URL, wallet, and
operational-detail fields by default. Raw sensitive exports are not a supported
controls behavior until a later explicit export policy is designed and accepted.

## Consequences

Agency live controls require `CONTROLS_ENABLED=true` in the deployment
environment. Missing or blank enablement disables protected controls APIs.

Legitimate production mutation clients must send browser-style same-origin
requests. If a future server-to-server controls client is introduced, it needs
a separate authenticated path rather than bypassing origin checks.

Export payloads are safer but less complete for forensic handoff. A future
raw-export capability must add a dedicated permission, confirmation, audit
metadata, and acceptance tests.
