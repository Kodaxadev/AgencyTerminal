# 16 — Assumption Kill List

## Purpose

This document removes SaaS/PaaS assumptions and forces Agency Terminal to stay what it is:

> A tribe-specific EVE Frontier Discord bot and controls page for The Agency.

It is not a public SaaS product, not a generic ticket platform, not a paid bot marketplace, and not a multi-tenant governance service.

## Hard Product Boundary

Agency Terminal exists for one tribe, one Discord guild, and one operational doctrine.

```text
Product: Agency Terminal
Audience: The Agency / Lux Letifera
Primary UI: Discord
Secondary UI: Internal controls page
Canonical data: Postgres Evidence Ledger
Deployment: Private, tribe-controlled
```

## Killed Assumptions

| Assumption | Decision | Reason |
|---|---|---|
| This needs billing | Killed | Not a SaaS |
| This needs multi-tenant admin UX | Killed | One guild only |
| This needs public onboarding | Killed | Installed manually for The Agency |
| This needs marketplace polish | Killed | Internal operational tool |
| This needs self-serve setup | Killed | Configured by trusted operator |
| This needs cross-tribe federation | Killed for v1 | Creates diplomacy/security scope creep |
| This needs generic ticket types | Mostly killed | All ticket types map to Agency doctrine |
| This needs automatic rank promotion | Killed | Bot makes contribution legible; humans decide authority |
| This needs automatic role grants | Killed for v1 | Prevents permission escalation mistakes |
| This needs on-chain writes | Killed for v1 | Read/reference only |
| This needs World API dependency | Killed for v1 | Manual evidence intake first |
| This needs public profile pages | Killed | Discord profile command + controls page only |
| This needs hosted public docs | Killed | Repo README and internal docs enough |
| This needs formal customer support | Killed | Operator runbook enough |
| This needs tenant isolation | Killed | Single guild, but keep `guild_id` as technical safety |
| This needs OAuth login for everyone | Killed | Controls page limited to operator/officer roles |

## Kept Assumptions

| Assumption | Status | Reason |
|---|---|---|
| Guild ID exists on all tables | Kept | Safety and future-proofing, not SaaS |
| Role mappings are config-driven | Kept | Agency roles may change |
| Evidence Ledger is append-only | Kept | Trust and audit integrity |
| Discord is workflow UI | Kept | This is a Discord-native tribe tool |
| Controls page exists | Kept | Some operations are too awkward for slash commands |
| Manual review stays central | Kept | Prevents bot from becoming political authority |
| Integrations are optional | Kept | EF data sources may change |

## Forbidden Scope Creep

Do not add these without a new ADR:

```text
billing
subscription tiers
multi-server signup
public account creation
automated rank promotion
automated demotion
automatic Discord role mutation
on-chain writes
wallet custody
payment handling
prediction markets
gambling mechanics
cross-tribe reputation sharing
public API
public dashboard
```

## Build Philosophy

Agency Terminal should be boring where trust matters:

```text
Manual over automatic.
Append-only over mutable.
Officer-reviewed over bot-decided.
Discord-native over platform-generic.
Agency-specific over reusable abstraction.
```

## Acceptance Criteria

- README never describes the bot as SaaS, PaaS, marketplace, or platform.
- Controls page has no billing, tenant selection, or public signup.
- Database keeps guild ID for safety, but UI assumes one configured guild.
- Every workflow maps to an Agency need: enlistment, contracts, intel, evidence, clearance, doctrine.
- No command mutates Discord authority roles automatically in v1.
