# Ticket Workflows

## 1. Enlistment Protocol

External-facing. First touchpoint for potential agents.

Fields:

- Discord handle
- EVE Frontier character name
- Timezone: EU / NA / Other
- Primary discipline
- Prior EVE/PvP experience
- What the applicant can contribute
- How they handle critique
- Solo/small-gang/fleet preference
- Evidence links

Statuses:

```text
SUBMITTED -> SCREENING -> INTERVIEW -> TRIAL_AGENT -> AUTHORIZED | DENIED -> ARCHIVED
```

## 2. Contract Intake

External-facing mercenary request workflow.

Fields:

- Client name
- Client tribe/affiliation
- Contract type
- Target/system/route/objective
- Desired outcome
- Operational window
- Payment terms
- Risk level
- Public/private contract
- Evidence/intel provided
- Diplomatic sensitivity

Statuses:

```text
INTAKE -> SCOPING -> PRICE_REVIEW -> ACCEPTED | DECLINED -> ACTIVE -> COMPLETED | FAILED -> PAID -> ARCHIVED
```

## 3. Intel Report

Internal intelligence intake.

Fields:

- System name
- Target character/tribe
- Smart object/gate/market/storage reference
- Threat type
- Observed activity
- Confidence level
- Evidence
- Source sensitivity
- Suggested action
- Signal Vault export intent

Statuses:

```text
RECEIVED -> VALIDATING -> CORROBORATED -> ACTIONABLE | STALE | FALSE -> EXPORTED -> ARCHIVED
```

## 4. Performance Evidence

Core ledger intake.

Fields:

- Metric category
- Description
- Related operation
- Evidence link/screenshot
- Witnesses
- Character name
- Transaction digest / killboard link / API reference

Statuses:

```text
SUBMITTED -> UNDER_REVIEW -> VALIDATED | REJECTED | NEEDS_MORE_EVIDENCE | DUPLICATE -> CREDITED -> ARCHIVED
```

## 5. Doctrine Challenge

Structured dissent and process improvement.

Fields:

- Doctrine/tactic/policy/operation being challenged
- Claim
- Reasoning
- Evidence
- Alternative proposal
- Expected downside if ignored
- Urgency

Statuses:

```text
SUBMITTED -> UNDER_REVIEW -> ACCEPTED_FOR_DISCUSSION -> ADOPTED | REJECTED_INSUFFICIENT_EVIDENCE | DEPRECATED -> ARCHIVED
```

Adopted challenges generate Evidence Ledger credit.

## 6. Clearance Request

Access, channel, role, operational area, or tool request.

Fields:

- Requested clearance
- Reason
- Relevant contribution history
- Sponsor
- Operational need
- Duration
- Risk if denied
- Risk if granted

Statuses:

```text
REQUESTED -> REVIEWING -> APPROVED | DENIED | TEMPORARY | REVOKED | EXPIRED
```
