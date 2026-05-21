# 29 — Appeals Workflow

## Purpose

A merit system without appeal becomes brittle and politically unsafe. Agency Terminal needs a structured way to challenge rejected or under-credited evidence without allowing infinite drama loops.

## Scope

Appeals apply to:

```text
rejected evidence
partially credited evidence
duplicate classification
needs_more_evidence closure
score reversal
```

Appeals do not apply to:

```text
ordinary pending reviews
active quorum review
spam closures marked final
director-only disciplinary notes
```

## Appeal Statuses

```ts
type AppealStatus =
  | "requested"
  | "under_review"
  | "granted"
  | "denied"
  | "final";
```

## Appeal Grounds

```ts
type AppealGround =
  | "new_evidence"
  | "procedural_error"
  | "wrong_subject"
  | "wrong_metric"
  | "wrong_points"
  | "duplicate_error"
  | "reversal_error";
```

## Command

```text
/evidence appeal EVD-0042
```

Required fields:

```text
appeal ground
new evidence or procedural objection
requested outcome
```

## Rules

```text
Only the submitter, credited subject, officer, or director can appeal.
Appeal must reference a closed evidence decision.
Appeal must include new evidence or a procedural objection.
Appeal should be reviewed by at least one reviewer who was not part of the original decision when possible.
Repeated appeals may be marked final.
All appeal outcomes write audit_log.
```

## Appeal Outcomes

### Granted

```text
evidence status may change
score event may be created
score correction may be created
audit log is posted
```

### Denied

```text
appeal status = denied
reason required
evidence remains unchanged
```

### Final

```text
appeal status = final
future appeals require director override
```

## UI Language

```text
SIG//EVIDENCE APPEAL
STATUS // CODE 202 // UNDER REVIEW

CASE: EVD-0042
GROUND: NEW EVIDENCE
REQUESTED OUTCOME: CREDIT RESTORED
```

Denied:

```text
SIG//EVIDENCE APPEAL
STATUS // CODE 403 // REJECTED

CASE: EVD-0042
REASON: No new evidence supplied.
STATUS: FINAL
```

## Acceptance Criteria

- Rejected evidence can be appealed.
- Appeal requires ground and explanation.
- Appeal reviewers are tracked.
- Appeal outcomes are auditable.
- Final appeal state prevents endless relitigation.
