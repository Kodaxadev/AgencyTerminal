# ADR-010 — EVE Frontier Integrations Are Manual-First

## Status

Accepted.

## Context

EVE Frontier data sources and APIs may change. Agency Terminal must remain useful without brittle integrations.

## Decision

v1 stores manual EF context fields and raw evidence URLs. External lookups are optional adapters. No on-chain writes or automatic smart-object access changes exist in v1.

## Consequences

- Evidence workflows work without EF API keys.
- Reviewers can still use EF-Map, killboard links, screenshots, and transaction digests manually.
- Future integrations can be added without refactoring the Evidence Ledger.
