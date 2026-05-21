# 23 — Doctrine Credit and Reversal Correction Spec

## Purpose

Two gaps need explicit handling:

1. Adopted Doctrine Challenges should create score credit.
2. There must be a safe path when a score reversal was created in error.

## Adopted Doctrine Challenge Credit

When a doctrine challenge reaches `adopted`, the bot should create a score event for the challenger.

Default category:

```text
technical_development_output
```

Alternative category:

```text
lore_discovery
```

Use `technical_development_output` for process, architecture, tooling, tactical doctrine, or governance changes. Use `lore_discovery` only when the adopted challenge directly concerns lore/archive interpretation.

## Adoption Transaction

```text
1. Begin transaction
2. Update doctrine_challenges.status = adopted
3. Update workflow_instances.workflow_status = adopted
4. Read metric_config for selected category and active version
5. Insert agent_score_event
6. Set doctrine_challenges.adopted_score_event_id
7. Insert audit_log
8. Insert discord_outbox events:
   - doctrine change post
   - audit embed
   - challenger notification, if enabled
9. Commit
```

## Required Adoption Fields

```ts
type DoctrineAdoptionInput = {
  challengeId: string;
  adoptedByDiscordId: string;
  creditedAgentDiscordId: string;
  metricCategory: "technical_development_output" | "lore_discovery";
  rationale: string;
};
```

## Reversal Correction

The original design allowed a score event to be reversed once. That is correct. However, if the reversal itself is later determined to be wrong, do not delete the reversal.

Instead, create a correction event.

```ts
type ScoreCorrectionType =
  | "restore_reversed_score"
  | "adjust_score_after_review";
```

Correction policy:

```text
Original score_event remains.
Original score_reversal remains.
New score_correction records why the reversal or value was corrected.
If restoring score, create a new positive agent_score_event linked to the correction.
```

## Why Not Delete Reversals?

Deleting reversals would create a silent trust failure. The ledger must show:

```text
credit → reversal → correction/restoration
```

not:

```text
credit → hidden edit
```

## Controls Page Behavior

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

## Acceptance Criteria

- Adopted doctrine challenge creates a score event.
- Doctrine challenge adoption and score credit happen in one transaction.
- Score reversals are never deleted.
- Mistaken reversals are corrected through score_corrections.
- Score correction requires director plus corroborating officer.
