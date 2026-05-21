# 18 — Auth and Permission Model

## Purpose

Agency Terminal handles operational and trust-sensitive information. Permission design must be explicit before build.

## Identity Sources

Agency Terminal has three identity layers:

1. Discord user ID — operational identity.
2. Optional EVE Frontier character name — game identity.
3. Optional wallet address — verification/evidence identity.

MVP canonical identity:

```text
Discord user ID
```

Character and wallet fields are evidence attributes, not authentication.

## Bot Command Permissions

Commands should check capabilities, not role names.

```ts
type Capability =
  | "can_view_all_tickets"
  | "can_validate_evidence"
  | "can_override_quorum"
  | "can_reverse_score"
  | "can_manage_clearance"
  | "can_manage_contracts"
  | "can_manage_intel"
  | "can_manage_config";
```

Capabilities map to Discord role IDs in `role_mappings`.

## Command Access Matrix

| Command | Member | Recruiter | Intel | Handler | Director | Operator |
|---|---:|---:|---:|---:|---:|---:|
| `/enlist start` | yes | yes | yes | yes | yes | yes |
| `/contract submit` | yes/public channel | yes | yes | yes | yes | yes |
| `/intel report` | yes | yes | yes | yes | yes | yes |
| `/evidence submit` | yes | yes | yes | yes | yes | yes |
| `/doctrine challenge` | yes | yes | yes | yes | yes | yes |
| `/ticket assign` | no | scoped | scoped | yes | yes | yes |
| `/evidence review` | no | no | scoped | yes | yes | yes |
| `/evidence override` | no | no | no | no | yes | yes |
| `/score reverse` | no | no | no | no | yes + corroborator | yes + corroborator |
| `/agency config` | no | no | no | no | limited | yes |

## Controls Page Permissions

| Page | Required capability |
|---|---|
| `/controls` | any mapped officer capability |
| `/controls/health` | `can_manage_config` |
| `/controls/config` | `can_manage_config` |
| `/controls/roles` | `can_manage_config` |
| `/controls/metrics` | `can_manage_config` |
| `/controls/evidence` | `can_validate_evidence` |
| `/controls/audit` | `can_view_all_tickets` or `can_manage_config` |
| `/controls/retention` | `can_manage_config` |
| `/controls/exports` | `can_manage_config` |

## Principle: No Hidden Superpowers

The bot owner/deployer may have infrastructure access, but in-app actions should still be logged as an actor.

If a maintenance script changes records, it must write:

```text
actor_discord_id: system/operator id if known
action: maintenance_script
payload: script name, reason, timestamp
```

## Discord Role Mutation Policy

v1 must not automatically grant or remove authority roles.

Allowed:

```text
read roles
check roles
mention roles
recommend role action
log role-related decisions
```

Forbidden in v1:

```text
auto-grant clearance role
auto-remove clearance role
auto-promote
auto-demote
auto-ban
auto-kick
```

## Session Security

Controls page sessions:

```text
httpOnly cookie
secure cookie in production
sameSite=Lax
short idle timeout
server-side role recheck on every request
```

Suggested duration:

```text
8 hours max session
30 minutes idle timeout for director-level pages
```

## Sensitive Action Confirmation

Require confirmation for:

```text
score reversal
director override
retention delete/redact
metric point table version update
role capability change
audit export
full ledger export
```

Confirmation format:

```text
Type REVERSE to continue.
Type DELETE to continue.
Type EXPORT to continue.
```

## Acceptance Criteria

- Capabilities are checked server-side.
- Controls page never trusts client-side role state.
- Discord user ID is canonical in MVP.
- Character/wallet identity never grants permissions by itself.
- Bot does not mutate Discord authority roles in v1.
- Every privileged action writes an audit entry.
