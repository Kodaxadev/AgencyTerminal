# Security, Privacy, and Counterintelligence

## Data sensitivity levels

```ts
type Sensitivity = "public" | "member" | "officer_only" | "director_only";
```

## High-risk data

- Intel reports and source identities
- Contract clients and payment terms
- Clearance denial reasons
- Score reversal details
- Doctrine disputes before adoption
- Private evidence attachments
- Backfill records with operational context

## Permission model

Capabilities are mapped to Discord roles. Never hardcode role names — store mappings by guild.

```ts
type Capability =
  | "can_manage_enlistment"
  | "can_manage_contracts"
  | "can_manage_intel"
  | "can_manage_clearance"
  | "can_validate_evidence"
  | "can_view_audit"
  | "can_manage_config"
  | "can_override_quorum"
  | "can_reverse_score"
  | "can_backfill_evidence"
  | "can_review_appeals";
```

## Command access matrix

| Command | Member | Recruiter | Intel | Handler | Director | Operator |
|---|---:|---:|---:|---:|---:|---:|
| `/enlist start` | yes | yes | yes | yes | yes | yes |
| `/contract submit` | yes | yes | yes | yes | yes | yes |
| `/intel report` | yes | yes | yes | yes | yes | yes |
| `/evidence submit` | yes | yes | yes | yes | yes | yes |
| `/doctrine challenge` | yes | yes | yes | yes | yes | yes |
| `/ticket assign` | no | scoped | scoped | yes | yes | yes |
| `/evidence review` | no | no | scoped | yes | yes | yes |
| `/evidence override` | no | no | no | no | yes | yes |
| `/score reverse` | no | no | no | no | yes + corroborator | yes + corroborator |
| `/agency config` | no | no | no | no | limited | yes |

## Controls page permissions

| Page | Required capability |
|---|---|
| `/controls` | any mapped officer capability |
| `/controls/health`, `/controls/config`, `/controls/roles`, `/controls/metrics` | `can_manage_config` |
| `/controls/evidence` | `can_validate_evidence` |
| `/controls/audit` | `can_view_audit` or `can_manage_config` |
| `/controls/retention`, `/controls/exports` | `can_manage_config` |

## Session security

Controls page sessions: httpOnly cookie, secure cookie in production, sameSite=Lax, short idle timeout, server-side role recheck on every request.

Suggested duration: 8 hours max session, 30 minutes idle timeout for director-level pages.

## Sensitive action confirmation

Require confirmation for: score reversal, director override, retention delete/redact, metric point table version update, role capability change, audit export, full ledger export.

Confirmation format: `Type REVERSE to continue.`, `Type DELETE to continue.`, `Type EXPORT to continue.`

## Counterintelligence

### Sensitive patterns

The bot must avoid exposing:
- Who submits intel and how often
- Which systems are under observation
- Which targets are under review
- Client identity and payment terms for contracts
- Clearance denial reasons
- Score reversals tied to sensitive incidents

### Default visibility

| Record | Default visibility |
|---|---|
| Intel report body | officer_only |
| Intel submitter identity | officer_only |
| Intel score count | officer_only |
| Contract client | officer_only |
| Contract payment terms | officer_only |
| Clearance denial reason | director_only or officer_only |
| Score reversal details | director_only |
| Public-safe profile metrics | member |
| Evidence quality tier | officer_only until accepted |

### Public profile rule

Public/member-visible profile output must exclude:
- `intelligence_acquisitions`
- Sensitive technical/development work if configured officer_only
- Asset contributions if operationally sensitive
- Pending evidence
- Rejected intel
- Reversals
- Source notes

### Queue redaction

Ops queue embeds should use redacted summaries for sensitive workflows:

```text
SIG//INTEL REPORT
STATUS // CODE 202 // RECEIVED

SYSTEM: [REDACTED]
SOURCE: [REDACTED]
PRIORITY: HIGH
CLEARANCE: INTEL OFFICER
```

### Contract intake rule

Public contract intake must never auto-post full details to public channels.

Public-facing response:
```text
Contract request received.
Submission does not imply acceptance.
A Contract Officer will review.
```

Private officer queue receives details.

### Export controls

Exports containing sensitive data require: `can_manage_config` or director-equivalent permission, explicit confirmation, audit log entry, sensitivity label in export metadata.

## MVP automation restrictions

The bot must not automatically:
- Grant or remove Discord authority roles
- Promote or demote agents
- Publish sensitive intel
- Accept contracts
- Reject enlistments
- Reverse score without review

## Audit requirements

Log all: ticket creation, status changes, reviewer approvals/objections, quorum completion, director override, score credit, score reversal, score correction, appeal outcomes, clearance grant/denial, doctrine adoption/rejection, export events, retention actions, config changes, maintenance scripts, backfill creation.

## Principle: No hidden superpowers

The bot owner/deployer may have infrastructure access, but in-app actions should still be logged as an actor. If a maintenance script changes records, it must write: `actor_discord_id: system/operator id`, `action: maintenance_script`, `payload: script name, reason, timestamp`.

## Discord role mutation policy

v1 must not automatically grant or remove authority roles. Allowed: read roles, check roles, mention roles, recommend role action, log role-related decisions.

Forbidden in v1: auto-grant clearance role, auto-remove clearance role, auto-promote, auto-demote, auto-ban, auto-kick.

## Data retention

| Data class | Default retention | Action after retention |
|---|---:|---|
| Open ticket channel | Until closed | Archive/delete after transcript |
| Closed ticket transcript | 365 days | Archive or delete |
| Evidence record | Indefinite | Manual deletion only |
| Evidence attachment copy | 365 days | Delete unless promoted to permanent |
| Audit log | Indefinite | Manual deletion only |
| Score event | Indefinite | Reversal only, no hard delete |
| Score reversal | Indefinite | Manual deletion only |
| Sensitive intel | 180 days | Redact/archive |
| Contract terms | 365 days | Archive/redact |
| Doctrine challenge | Indefinite if adopted; 365 days if rejected | Archive or redact |

Retention rules are configurable per guild. Destructive retention jobs support dry run and write to `audit_log`. Score records should not be deleted during normal operations — use reversal/correction.

## Redaction policy

Redaction is appropriate for: contract client names, payment terms, sensitive source identities, intel source notes, personal contact details, screenshots containing unrelated private information.

Redaction should not alter: evidence ID, metric category, validation decision, reviewer identities for officer/audit view, score amount, reversal reason.
