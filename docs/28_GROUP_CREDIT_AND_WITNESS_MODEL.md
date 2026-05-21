# 28 — Group Credit and Witness Model

## Purpose

Agency Terminal originally modeled evidence as if one evidence record maps to one credited agent. That is insufficient for EVE Frontier tribe operations.

Many Agency contributions are group-based:

```text
fleet participation
contract completion
asset defense
logistics runs
recon/scouting chains
exploration routes
technical work
lore/archive work
```

The system needs to distinguish between:

```text
Submitter    → who filed the evidence
Subject      → who receives credit
Witness      → who corroborates the event
Reviewer     → who validates the evidence
```

## Decision

Add two explicit models:

```text
evidence_subjects
evidence_witnesses
```

`evidence.subject_discord_id` may remain as a compatibility/default field, but v1 implementation should prefer `evidence_subjects`.

## Evidence Subjects

An evidence subject is a credited participant.

```ts
type EvidenceSubjectRole =
  | "primary"
  | "supporting"
  | "witness_only";

type EvidenceSubject = {
  id: string;
  evidenceId: string;
  subjectDiscordId: string;
  role: EvidenceSubjectRole;
  pointMultiplier: number;
  note?: string;
  createdAt: string;
};
```

## Role Semantics

| Role | Receives score? | Meaning |
|---|---:|---|
| `primary` | yes | Main contributor or operation lead |
| `supporting` | yes | Valid supporting participant |
| `witness_only` | no by default | Listed for context, not credit |

`witness_only` exists here only for migration/UX convenience. Preferred witness storage is `evidence_witnesses`.

## Point Multipliers

Default:

```text
primary: 1.0
supporting: 1.0
witness_only: 0.0
```

Do not over-optimize point splits in v1. The first version should avoid complicated formulas.

Recommended v1 policy:

```text
Every credited subject receives the configured metric points unless a reviewer manually sets a multiplier.
```

Examples:

```text
Fleet participation: all participants = 1.0
Contract completion: lead = 1.0, support = 1.0
Technical project: primary implementer = 1.0, reviewer/tester = 0.5 if The Agency wants partial credit
```

## Evidence Witnesses

A witness corroborates evidence but does not automatically receive score.

```ts
type EvidenceWitness = {
  id: string;
  evidenceId: string;
  witnessDiscordId: string;
  witnessType: "participant" | "observer" | "officer" | "external_source";
  statement?: string;
  createdAt: string;
};
```

## Reviewer vs Witness

A reviewer decides whether evidence is valid.

A witness says the event happened.

These must not be conflated.

```text
Witness: "I was there."
Reviewer: "This evidence meets the validation standard."
```

## Scoring Transaction for Group Evidence

When evidence is validated:

```text
1. Read active metric config.
2. Read all evidence_subjects where role in primary/supporting.
3. For each subject:
   - calculate approved points = base_points * point_multiplier
   - create one agent_score_event
4. Mark evidence as credited.
5. Write audit log.
```

## UX Requirements

Evidence modal should support:

```text
Credit recipient(s)
Witnesses, if any
Event occurred at
Evidence link(s)
```

For Discord modal limitations, use a two-step flow:

```text
/evidence submit
→ modal for core details
→ bot posts private draft embed
→ buttons: Add Subject, Add Witness, Add Evidence Link, Submit for Review
```

## Acceptance Criteria

- One evidence record can credit multiple agents.
- Witnesses do not automatically receive score.
- Reviewers remain distinct from witnesses.
- Score events are created per credited subject.
- Public profile sums score events, not evidence records.
