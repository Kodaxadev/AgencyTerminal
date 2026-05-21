# ADR-002 — Evidence Ledger Is Append-Only

## Status

Accepted.

## Decision

The Evidence Ledger is append-only. Score corrections use reversal and correction events, not destructive updates.

## Consequences

Full audit trail. History cannot be silently altered. Reversal is always more protected than validation.
