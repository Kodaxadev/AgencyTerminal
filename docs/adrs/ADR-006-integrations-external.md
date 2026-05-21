# ADR-006 — Integrations Are External

## Status

Accepted.

## Decision

Signal Vault, FrontierWarden, killboard enrichment, and World API support are external integrations behind adapters, not v1 dependencies. v1 is manual-first.

## Consequences

Evidence workflows work without EF API keys. Future integrations can be added without refactoring the Evidence Ledger.
