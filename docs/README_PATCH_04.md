# Gap Closure Pack 04

This is the final recommended pre-build design patch.

## Adds

```text
28_GROUP_CREDIT_AND_WITNESS_MODEL.md
29_APPEALS_WORKFLOW.md
30_BACKFILL_AND_EVENT_TIME_POLICY.md
31_SOFT_LAUNCH_POLICY.md
32_AGENCY_TERMINAL_OPERATING_DOCTRINE.md
33_COUNTERINTELLIGENCE_POLICY.md
34_REVIEWER_LOAD_AND_CONFLICT_POLICY.md
35_EVIDENCE_QUALITY_TIERS.md
36_NEGATIVE_EVIDENCE_BOUNDARY.md
37_RED_TEAM_CHECKLIST.md
38_PACK_04_SCHEMA_NOTES.md
```

## Adds Migration

```text
007_group_credit_appeals_backfill.sql
```

## Adds Types

```text
schema/pack04-types.ts
```

## Adds ADRs

```text
ADR-012-group-credit-and-witnesses.md
ADR-013-appeals-before-authority.md
ADR-014-shadow-mode-first.md
ADR-015-no-negative-public-score.md
```

## Key Decisions

- One evidence record can credit multiple agents.
- Witnesses are distinct from reviewers and credited subjects.
- Rejected evidence can be appealed.
- Backfilled evidence is explicitly marked.
- Event time and submission time are separate.
- Soft launch begins in shadow mode.
- Intel and contract data are counterintelligence-sensitive.
- Negative public scoring is forbidden in v1.
