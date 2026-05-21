# ADR-011 — No Automatic Authority Mutation in v1

## Status

Accepted.

## Context

Agency Terminal tracks contribution, clearance, and evidence. Automatically granting/removing Discord roles could turn the bot into political authority before the tribe trusts it.

## Decision

v1 may recommend or record authority changes but must not automatically grant, remove, promote, demote, ban, or kick.

## Consequences

- Lower risk.
- More human review.
- Better alignment with the principle that the bot makes contribution legible; it does not decide who is valuable.
