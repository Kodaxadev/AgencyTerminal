# ADR-012 — Group Credit and Witnesses

## Status

Accepted.

## Context

EVE Frontier tribal operations are frequently group-based. A one-evidence-to-one-agent model would force duplicate evidence records and make fleet/contract credit messy.

## Decision

Agency Terminal will support multiple credited subjects and separate witnesses per evidence record.

## Consequences

- Score events are created per credited subject.
- Witnesses do not automatically receive credit.
- Reviewers remain distinct from witnesses.
- Evidence submission UI becomes a two-step flow to support Discord modal limitations.
