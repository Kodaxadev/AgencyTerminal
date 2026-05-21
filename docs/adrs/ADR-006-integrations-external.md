# Adr 006 Integrations External

## Status

Accepted for concept design.

## Decision

Signal Vault, FrontierWarden, killboard enrichment, and World API support are external integrations, not v1 dependencies.

## Consequences

This keeps v1 operationally simple while preserving the auditability needed for doctrine-aligned contribution tracking.
