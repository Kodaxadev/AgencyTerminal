# ADR-010 — EVE Frontier Integrations Are Manual-First

## Status

Accepted.

## Decision

v1 stores manual EF context fields and raw evidence URLs. External lookups are optional adapters. No on-chain writes or automatic smart-object access changes.

## Consequences

Bot remains useful if EF-Map or World API is unavailable. External values are never treated as verified unless explicitly resolved.
