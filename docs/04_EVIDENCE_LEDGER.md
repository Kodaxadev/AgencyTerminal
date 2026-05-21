# Evidence Ledger Design

## Purpose

The Evidence Ledger is the canonical record of measurable contribution. Every validated contribution should produce an immutable score event. Every reversal should produce a reversal event. Scores should be computed from events, never hand-edited.

## Metric categories

- PvP Kill Value
- Fleet Participation
- Contracts Completed
- Intelligence Acquisitions
- Technical / Development Output
- Asset Contributions
- Exploration
- Lore Discovery

## Evidence status

```ts
type EvidenceStatus =
  | "submitted"
  | "under_review"
  | "stale_review"
  | "needs_more_evidence"
  | "validated"
  | "rejected"
  | "duplicate"
  | "credited"
  | "reversed";
```

## Identity and subject semantics

```text
submitted_by_discord_id  → who filed the evidence
subject_discord_id       → who receives credit if validated
```

If `subject_discord_id` is null at submission time, it defaults to `submitted_by_discord_id`. Score credit always goes to `subject_discord_id`, not necessarily the submitter.

### Submission modes

- **Self-submission**: `submitted_by == subject` (agent submits own contribution)
- **Peer submission**: `submitted_by != subject` (officer/FC submits for someone else)
- **System/import**: Reserved for future integrations

Evidence modal should ask: "Who should receive credit?" with default "yourself."
Reviewer embed shows: `SUBMITTED BY: @submitter` / `CREDIT SUBJECT: @agent`

## Group credit and witnesses

One evidence record can credit multiple agents.

### Evidence subjects

```ts
type EvidenceSubjectRole = "primary" | "supporting" | "witness_only";

type EvidenceSubject = {
  evidenceId: string;
  subjectDiscordId: string;
  role: EvidenceSubjectRole;
  pointMultiplier: number;  // default 1.0
  note?: string;
};
```

| Role | Receives score? | Meaning |
|---|---:|---|
| `primary` | yes | Main contributor or operation lead |
| `supporting` | yes | Valid supporting participant |
| `witness_only` | no by default | Listed for context, not credit |

**v1 policy**: Every credited subject receives the configured metric points unless a reviewer manually sets a multiplier.

### Evidence witnesses

A witness corroborates evidence but does not automatically receive score.

```ts
type EvidenceWitness = {
  evidenceId: string;
  witnessDiscordId?: string;
  witnessType: "participant" | "observer" | "officer" | "external_source";
  statement?: string;
  externalReference?: string;
};
```

Witness ≠ Reviewer. Witness says "I was there." Reviewer says "This evidence meets the validation standard."

### Scoring transaction for group evidence

```text
1. Read active metric config.
2. Read all evidence_subjects where role in primary/supporting.
3. For each subject: calculate approved points = base_points * point_multiplier
4. Create one agent_score_event per subject.
5. Mark evidence as credited.
6. Write audit log.
```

## Backfill and event time

Evidence stores `event_occurred_at` separately from `created_at`.

```ts
type SubmittedMode = "live_bot" | "manual_backfill" | "imported";
```

### Manual backfill
Used when bot was unavailable, operation occurred before bot launch, or officer needs to credit a group after fleet/contract.

Requires: `backfilled_by`, `backfill_reason`, source link/attachment, `event_occurred_at`.

Only available to: `can_validate_evidence`, `can_manage_config`, or director-equivalent.

Backfilled evidence is visibly marked and does not bypass review or quorum.

## Evidence quality tiers

Reviewers choose a quality tier when validating or rejecting:

| Tier | Meaning | Typical handling |
|---|---|---|
| A | Independently verifiable | Strongest evidence |
| B | Strong screenshot/link/witness support | Usually acceptable |
| C | Plausible but weakly corroborated | May need additional review |
| D | Insufficient | Reject or request more evidence |
| F | False/forged | Reject, possible incident review |

Quality tier does not automatically change points in v1. A/B credit normally, C requires reviewer judgment, D/F receive no credit. F-tier triggers incident review visibility to directors.

## Negative evidence boundary

v1 does not create negative public score. Allowed: incident tickets, evidence rejection, false/forged quality tier, score reversal, director-only notes. Forbidden: negative public points, public shame score, automatic demotion, automatic role removal, automatic blacklist, public misconduct profile.

Rejected evidence remains part of the evidence record. Forged evidence may create an incident ticket, audit log, and director-only note, but not automatic public negative score.

Any future negative reputation feature requires a new ADR.

## Quorum policy

Default validation policy:

| Evidence type | Validation mode |
|---|---|
| PvP Kill Value | two-reviewer quorum |
| Fleet Participation | single FC/officer |
| Contracts Completed | contract officer + witness |
| Intelligence Acquisitions | intel officer quorum |
| Technical / Development Output | technical officer or director |
| Asset Contributions | logistics/finance officer |
| Exploration | one reviewer unless sensitive |
| Lore Discovery | one reviewer or archive officer |

## Timeout escalation

```text
Evidence submitted -> UNDER_REVIEW -> 48h without quorum: STALE_REVIEW
-> post to #ops-queue
-> Handler/Director may unblock with director_override
-> audit log required
```

## Points

Use fixed configurable point tables in v1. Agents do not self-propose points.

```ts
type MetricConfig = {
  category: AgencyMetricCategory;
  basePoints: number;
  visibility: "public" | "officer_only";
  enabled: boolean;
  version: number;
};
```

## Score event

```ts
type AgentScoreEvent = {
  id: string;
  guildId: string;
  evidenceId: string;
  agentDiscordId: string;
  metricCategory: AgencyMetricCategory;
  pointSource: "configured_table" | "director_override" | "manual_adjustment";
  pointsApproved: number;
  pointsTableVersion: number;
  creditedBy: string;
  creditedAt: string;
  status: "credited" | "reversed";
};
```

## Score reversal

Score reversal requires:
1. Director-level actor.
2. One corroborating officer.
3. Mandatory reversal reason.
4. Mandatory audit-log post.
5. Optional notification to affected agent.

Reversal is always more protected than validation.

## Score correction

If a reversal was created in error, do not delete the reversal. Create a correction event:

```ts
type ScoreCorrectionType = "restore_reversed_score" | "adjust_score_after_review";
```

Correction policy:
- Original `score_event` remains.
- Original `score_reversal` remains.
- New `score_correction` records why the reversal or value was corrected.
- If restoring score, create a new positive `agent_score_event` linked to the correction.

## Doctrine challenge credit

When a doctrine challenge reaches `adopted`, create a score event for the challenger.

Default category: `technical_development_output` (for process, architecture, tooling, tactical doctrine, governance changes).
Alternative: `lore_discovery` (only when challenge concerns lore/archive interpretation).

Adoption transaction:
```text
1. Begin transaction
2. Update doctrine_challenges.status = adopted
3. Update workflow_instances.workflow_status = adopted
4. Read metric_config for selected category and active version
5. Insert agent_score_event
6. Set doctrine_challenges.adopted_score_event_id
7. Insert audit_log
8. Insert discord_outbox events (doctrine change post, audit embed, notification)
9. Commit
```

## Appeals workflow

Appeals apply to: rejected evidence, partially credited evidence, duplicate classification, needs_more_evidence closure, score reversal.

Appeals do not apply to: ordinary pending reviews, active quorum review, spam closures marked final, director-only disciplinary notes.

```ts
type AppealStatus = "requested" | "under_review" | "granted" | "denied" | "final";
type AppealGround = "new_evidence" | "procedural_error" | "wrong_subject" | "wrong_metric" | "wrong_points" | "duplicate_error" | "reversal_error";
```

Rules:
- Only the submitter, credited subject, officer, or director can appeal.
- Appeal must reference a closed evidence decision and include new evidence or procedural objection.
- Appeal reviewed by at least one reviewer not part of original decision when possible.
- Repeated appeals may be marked `final`.
- All outcomes write `audit_log`.

Command: `/evidence appeal EVD-0042`

## Reviewer load and conflict

Review records support `conflict_disclosed` boolean and `conflict_reason` text.

Conflict examples: same fleet, same contract team, close ally, same dispute, direct beneficiary.

v1 does not automatically block conflicted reviews — it records the disclosure. For high-value or sensitive evidence, at least one non-conflicted reviewer should approve.

Assignment recommendation sorts by: has required capability → fewest pending assigned reviews → fewest reviews in last 7 days → not already reviewer on this evidence → not marked conflict_disclosed.
