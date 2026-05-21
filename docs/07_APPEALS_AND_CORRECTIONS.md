# Appeals and Corrections

## Purpose

A merit system without appeal becomes brittle and politically unsafe. Agency Terminal needs a structured way to challenge rejected or under-credited evidence, and a safe path when a score reversal was created in error.

## Appeals

### Scope

Appeals apply to:
- Rejected evidence
- Partially credited evidence
- Duplicate classification
- Needs_more_evidence closure
- Score reversal

Appeals do not apply to:
- Ordinary pending reviews
- Active quorum review
- Spam closures marked final
- Director-only disciplinary notes

### Statuses and grounds

```ts
type AppealStatus = "requested" | "under_review" | "granted" | "denied" | "final";

type AppealGround =
  | "new_evidence"
  | "procedural_error"
  | "wrong_subject"
  | "wrong_metric"
  | "wrong_points"
  | "duplicate_error"
  | "reversal_error";
```

### Command

```text
/evidence appeal EVD-0042
```

Required fields: appeal ground, new evidence or procedural objection, requested outcome.

### Rules

- Only the submitter, credited subject, officer, or director can appeal.
- Appeal must reference a closed evidence decision.
- Appeal must include new evidence or a procedural objection.
- Appeal should be reviewed by at least one reviewer who was not part of the original decision when possible.
- Repeated appeals may be marked `final`.
- All appeal outcomes write `audit_log`.

### Outcomes

**Granted**: evidence status may change, score event may be created, score correction may be created, audit log is posted.

**Denied**: appeal status = denied, reason required, evidence remains unchanged.

**Final**: appeal status = final, future appeals require director override.

### UI Language

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

## Score Corrections

The original design allowed a score event to be reversed once. That is correct. However, if the reversal itself is later determined to be wrong, do not delete the reversal. Instead, create a correction event.

```ts
type ScoreCorrectionType = "restore_reversed_score" | "adjust_score_after_review";
```

### Correction policy

```text
Original score_event remains.
Original score_reversal remains.
New score_correction records why the reversal or value was corrected.
If restoring score, create a new positive agent_score_event linked to the correction.
```

### Why not delete reversals?

Deleting reversals would create a silent trust failure. The ledger must show:

```text
credit → reversal → correction/restoration
```

not:

```text
credit → hidden edit
```

### Controls page behavior

For a mistaken reversal:
```text
Director selects reversed score event
→ chooses "Correct Reversal"
→ provides reason
→ selects corroborating officer
→ system creates score_correction
→ if restore is selected, system creates a new score_event
→ audit log posts correction
```

Score correction requires director plus corroborating officer.

## Acceptance Criteria

- Rejected evidence can be appealed.
- Appeal requires ground and explanation.
- Appeal reviewers are tracked.
- Appeal outcomes are auditable.
- Final appeal state prevents endless relitigation.
- Score reversals are never deleted.
- Mistaken reversals are corrected through score_corrections.
- Score correction requires director plus corroborating officer.
- Adopted doctrine challenge creates a score event in one transaction.
