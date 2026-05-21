# 19 — EVE Frontier Boundary and Integration Rules

## Purpose

Agency Terminal is EVE Frontier-specific, but v1 must not depend on unstable or unavailable game integrations. It should be ready to link evidence to game/world data later without blocking core workflows.

## Current Integration Boundary

v1 supports:

```text
manual character name
manual wallet address
manual system name
manual smart object id
manual killboard/evidence URL
manual transaction digest
manual EF-Map link
```

v1 does not require:

```text
World API lookup
killboard parsing
wallet login
zkLogin
on-chain writes
in-game browser context
Smart Assembly control
Smart Gate policy mutation
```

## Why

The bot's job is to make tribe contribution legible. It should not fail because an external API changes or because a game-data integration is not ready.

## Integration Modes

| Mode | v1 Status | Notes |
|---|---|---|
| Raw URL | supported | Store as evidence link |
| Manual fields | supported | Character, system, object ID |
| EF-Map route/killboard link | supported as URL | Do not scrape initially |
| World API read | deferred | Add behind adapter later |
| Signal Vault export | deferred | Store `signalVaultId` later |
| FrontierWarden lookup | deferred | Read-only context later |
| On-chain write | forbidden | New ADR required |

## Adapter Rule

Every external integration must sit behind an adapter:

```ts
type ExternalEvidenceAdapter = {
  source: "ef_map" | "world_api" | "signal_vault" | "frontierwarden";
  canResolve(input: string): boolean;
  resolve(input: string): Promise<ResolvedExternalEvidence>;
};
```

The core evidence ledger must not import SDKs directly.

## No Guessing Rule

If an external lookup fails:

```text
store the submitted value
mark parsed = false
allow manual review
show lookup failure in reviewer UI
```

Never invent:

```text
system IDs
kill values
wallet ownership
character ownership
tribe membership
contract completion
```

## Smart Gate / Access Rule

Agency Terminal may record a clearance decision. It must not mutate gate policy or smart object access in v1.

Allowed:

```text
CLEARANCE: APPROVED
Recommended operator action: add access manually
```

Forbidden:

```text
automatic smart gate allowlist mutation
automatic smart object policy mutation
automatic on-chain transaction submission
```

## Future Integration Checklist

Before enabling any EF integration:

```text
source documented
rate limits known
failure behavior defined
test fixtures added
manual fallback preserved
adapter isolated
no secret leaked to client
no on-chain write without explicit ADR
```

## Acceptance Criteria

- Evidence submission works with no EF API keys.
- Bot remains useful if EF-Map or World API is unavailable.
- External values are never treated as verified unless explicitly resolved.
- All parsed external data is stored with source and timestamp.
- No on-chain write path exists in v1.
