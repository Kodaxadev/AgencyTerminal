# 25 — Controls Access Scoping Patch

## Problem

The previous controls page spec said `/controls` is available to “any mapped officer capability.” That is too broad and underspecified.

A recruiter may need enlistment access but should not see intel, score reversals, contract terms, or clearance disputes.

## Decision

Controls page access is page-scoped and dataset-scoped.

## Page Capabilities

| Page | Required capability |
|---|---|
| `/controls` | at least one controls-visible capability |
| `/controls/health` | `can_manage_config` |
| `/controls/config` | `can_manage_config` |
| `/controls/roles` | `can_manage_config` |
| `/controls/metrics` | `can_manage_config` |
| `/controls/evidence` | `can_validate_evidence` |
| `/controls/evidence/intel` | `can_manage_intel` |
| `/controls/contracts` | `can_manage_contracts` |
| `/controls/clearance` | `can_manage_clearance` |
| `/controls/audit` | `can_view_all_tickets` or `can_manage_config` |
| `/controls/retention` | `can_manage_config` |
| `/controls/exports` | `can_manage_config` |

## Dataset Filters

Even if a user can access a page, they see only records matching their scope.

Examples:

```text
Recruiter:
  Can see enlistment tickets only.

Intel Officer:
  Can see intel tickets and intelligence evidence only.

Contract Officer:
  Can see contract tickets and contract details only.

Handler:
  Can see general evidence review queues except director_only records.

Director:
  Can see all records.
```

## Capability Additions

Add these capabilities if needed:

```ts
type Capability =
  | "can_manage_enlistment"
  | "can_manage_contracts"
  | "can_manage_intel"
  | "can_manage_clearance"
  | "can_validate_evidence"
  | "can_view_audit"
  | "can_manage_config";
```

## Acceptance Criteria

- Recruiter cannot see intel records through controls page.
- Intel officer cannot see contract payment terms unless separately authorized.
- Contract officer cannot see doctrine disputes unless separately authorized.
- Director can see all records.
- Dataset filtering happens server-side.
