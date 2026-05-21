# 14 — Data Retention Policy

## Purpose

Agency Terminal stores sensitive operational data: enlistment records, contracts, intelligence, evidence, clearance decisions, doctrine challenges, score events, and audit logs. Retention must balance operational memory, privacy, and governance integrity.

## Core Policy

- Discord channels are workflow surfaces, not permanent records.
- Postgres is the canonical ledger.
- Score events, reversals, and audit records are governance records and should be retained longer than routine ticket discussion.
- Sensitive intel and contract terms should be retained only as long as operationally useful unless leadership explicitly archives them.

## Data Classes

| Data class | Default retention | Action after retention | Notes |
|---|---:|---|---|
| Open ticket channel | Until closed | Archive/delete channel after transcript | Discord is not source of truth |
| Closed ticket transcript | 365 days | Archive or delete | Longer for contract/evidence disputes |
| Evidence record | Indefinite | Manual deletion only | Core contribution ledger |
| Evidence attachment copy | 365 days | Delete unless promoted to permanent evidence | Avoid unbounded storage |
| Audit log | Indefinite | Manual deletion only | Governance integrity |
| Score event | Indefinite | Reversal only, no hard delete | Append-only |
| Score reversal | Indefinite | Manual deletion only | Highest trust record |
| Sensitive intel | 90–180 days | Redact/archive | Depends on operational sensitivity |
| Contract terms | 365 days | Archive/redact | Payment/client data can be sensitive |
| Doctrine challenge | Indefinite if adopted; 365 days if rejected | Archive or redact | Adopted challenges are doctrine history |

## Recommended MVP Defaults

```text
ticket_channel: archive/delete after transcript
ticket_transcript: 365 days
evidence_record: indefinite
evidence_attachment_copy: 365 days
audit_log: indefinite
score_event: indefinite
score_reversal: indefinite
intel_sensitive: 180 days
contract_terms: 365 days
doctrine_challenge: indefinite if adopted, 365 days if rejected
```

## Retention Levels

Use configurable retention policies:

```ts
type RetentionPolicy = {
  class:
    | "ticket_channel"
    | "ticket_transcript"
    | "evidence_record"
    | "evidence_attachment_copy"
    | "audit_log"
    | "score_event"
    | "score_reversal"
    | "intel_sensitive"
    | "contract_terms"
    | "doctrine_challenge";
  retainDays: number | null; // null = indefinite
  action: "retain" | "archive" | "delete" | "redact";
  sensitivity: "public" | "member" | "officer_only" | "director_only";
};
```

## Deletion vs Reversal

Score records should not be deleted during normal operations.

Incorrect credit:

```text
Create score_reversal
Mark original score_event as reversed
Preserve both records
```

This protects against silent demotion or favoritism.

## Redaction Policy

Redaction is appropriate for:

- Contract client names
- Payment terms
- Sensitive source identities
- Intel source notes
- Personal contact details
- Screenshots containing unrelated private information

Redaction should not alter:

- Evidence ID
- Metric category
- Validation decision
- Reviewer identities for officer/audit view
- Score amount
- Reversal reason

## Export Policy

Admin export should support:

```text
/agency export ledger
/agency export tickets --since YYYY-MM-DD
/agency export audit --since YYYY-MM-DD
/agency export agent @agent
```

Exports should include metadata:

```json
{
  "exportedAt": "ISO timestamp",
  "exportedBy": "discord id",
  "guildId": "discord guild id",
  "containsSensitiveData": true,
  "retentionPolicyVersion": 1
}
```

## Access Policy

| Record | Public | Member | Officer | Director |
|---|---:|---:|---:|---:|
| Public profile metrics | yes | yes | yes | yes |
| Full profile metrics | no | no | yes | yes |
| Intel acquisition details | no | no | yes | yes |
| Score reversals | no | no | limited | yes |
| Contract terms | no | no | role-based | yes |
| Audit log | no | no | yes | yes |
| Retention config | no | no | no | yes |

## Operational Commands

Recommended commands:

```text
/agency retention show
/agency retention set ticket_transcript 365 archive
/agency retention set intel_sensitive 180 redact
/agency retention run-dry
/agency retention run
```

`run-dry` should always show affected counts before destructive action.

## Acceptance Criteria

- Closed tickets generate transcript records before channel deletion.
- Evidence records and score events are not hard-deleted by automated retention.
- Sensitive intel has shorter retention than governance records.
- Retention rules are configurable per guild.
- Destructive retention jobs support dry run.
- Every retention job writes to audit_log.
