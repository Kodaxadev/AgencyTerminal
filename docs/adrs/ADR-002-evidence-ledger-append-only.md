# Adr 002 Evidence Ledger Append Only

## Status

Accepted for concept design.

## Decision

The Evidence Ledger is append-only. Score corrections use reversal events, not destructive updates.

## Consequences

This keeps v1 operationally simple while preserving the auditability needed for doctrine-aligned contribution tracking.
