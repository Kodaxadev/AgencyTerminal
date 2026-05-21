# Group Credit and Witnesses

## Purpose

EVE Frontier tribal operations are frequently group-based. Fleet participation, contract completion, asset defense, logistics runs, recon/scouting chains, exploration routes, technical work, and lore/archive work often involve multiple participants.

The system distinguishes between:

```text
Submitter    → who filed the evidence
Subject      → who receives credit
Witness      → who corroborates the event
Reviewer     → who validates the evidence
```

## Evidence Subjects

An evidence subject is a credited participant.

```ts
type EvidenceSubjectRole = "primary" | "supporting" | "witness_only";

type EvidenceSubject = {
  id: string;
  evidenceId: string;
  subjectDiscordId: string;
  role: EvidenceSubjectRole;
  pointMultiplier: number;   // default 1.0, check >= 0
  note?: string;
  createdAt: string;
};
```

### Role semantics

| Role | Receives score? | Meaning |
|---|---:|---|
| `primary` | yes | Main contributor or operation lead |
| `supporting` | yes | Valid supporting participant |
| `witness_only` | no by default | Listed for context, not credit |

`witness_only` exists in this table for migration/UX convenience. Preferred witness storage is `evidence_witnesses`.

### Point multipliers

Default: `primary: 1.0`, `supporting: 1.0`, `witness_only: 0.0`

**v1 policy**: Every credited subject receives the configured metric points unless a reviewer manually sets a multiplier. Do not over-optimize point splits in v1.

Examples:
- Fleet participation: all participants = 1.0
- Contract completion: lead = 1.0, support = 1.0
- Technical project: primary implementer = 1.0, reviewer/tester = 0.5 if The Agency wants partial credit

## Evidence Witnesses

A witness corroborates evidence but does not automatically receive score.

```ts
type EvidenceWitnessType = "participant" | "observer" | "officer" | "external_source";

type EvidenceWitness = {
  id: string;
  evidenceId: string;
  witnessDiscordId?: string;
  witnessType: EvidenceWitnessType;
  statement?: string;
  externalReference?: string;
  createdAt: string;
};
```

## Reviewer vs Witness

```text
Witness: "I was there."
Reviewer: "This evidence meets the validation standard."
```

These must not be conflated. Review records include `conflict_disclosed` and `conflict_reason` fields separately.

## Scoring Transaction for Group Evidence

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
