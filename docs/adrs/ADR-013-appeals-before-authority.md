# ADR-013 — Appeals Before Authority

## Status

Accepted.

## Context

A merit ledger that affects trust or clearance must support challenge of rejected evidence and mistaken reversals.

## Decision

Agency Terminal will implement appeals before the ledger is used for operational authority decisions.

## Consequences

- Shadow mode cannot exit until appeals exist.
- Rejected evidence can be challenged with new evidence or procedural objections.
- Repeated appeals may be marked final.
- Appeal outcomes are auditable.
