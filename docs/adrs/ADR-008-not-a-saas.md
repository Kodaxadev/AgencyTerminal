# ADR-008 — Agency Terminal Is Not SaaS

## Status

Accepted.

## Context

The project could drift toward a generic tribe-ticket platform, but the current goal is a specific tool for The Agency.

## Decision

Agency Terminal will be designed as a single-tribe Discord bot and controls page. It will not include billing, public signup, tenant management, subscription plans, public API access, or generic marketplace positioning.

## Consequences

- Simpler architecture.
- Less security surface.
- Faster path to actual tribe usefulness.
- Some future reuse remains possible because tables retain `guild_id`, but UI and product language stay Agency-specific.
