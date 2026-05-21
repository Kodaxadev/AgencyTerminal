# 33 — Counterintelligence Policy

## Purpose

Agency Terminal will handle intel, contracts, source-sensitive evidence, and clearance decisions. This creates counterintelligence risk.

The goal is not perfect secrecy. The goal is to prevent the bot from accidentally exposing sensitive patterns.

## Sensitive Patterns

The bot must avoid exposing:

```text
who submits intel
how often a specific agent submits intel
which systems are under observation
which targets are under review
client identity for contracts
contract payment terms
clearance denial reasons
score reversals tied to sensitive incidents
```

## Default Visibility

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

## Public Profile Rule

Public/member-visible profile output must exclude:

```text
intelligence_acquisitions
sensitive technical/development work if configured officer_only
asset contributions if operationally sensitive
pending evidence
rejected intel
reversals
source notes
```

## Queue Redaction

Ops queue embeds should use redacted summaries for sensitive workflows.

Example:

```text
SIG//INTEL REPORT
STATUS // CODE 202 // RECEIVED

SYSTEM: [REDACTED]
SOURCE: [REDACTED]
PRIORITY: HIGH
CLEARANCE: INTEL OFFICER
```

## Contract Intake Rule

Public contract intake must never auto-post full details to public channels.

Public-facing response:

```text
Contract request received.
Submission does not imply acceptance.
A Contract Officer will review.
```

Private officer queue receives details.

## Export Controls

Exports containing sensitive data require:

```text
can_manage_config or director-equivalent permission
explicit confirmation
audit log entry
sensitivity label in export metadata
```

## Retention

Sensitive intel should have shorter retention than governance records.

Recommended:

```text
intel_sensitive: 180 days, then redact/archive
contract_terms: 365 days, then archive/redact
score_events: indefinite
audit_log: indefinite
```

## Acceptance Criteria

- Intel score counts are not member-visible by default.
- Sensitive queues redact public summaries.
- Public contract intake never exposes full contract details.
- Exports are audited.
- Sensitive intel has retention policy.
