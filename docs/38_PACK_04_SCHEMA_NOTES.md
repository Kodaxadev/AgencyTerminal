# 38 — Pack 04 Schema Notes

## Summary

Pack 04 adds the final major pre-build modeling corrections:

```text
group credit
witnesses
appeals
backfill/import mode
event occurred time
reviewer conflicts
evidence quality tiers
negative evidence boundary
```

## New/Changed Tables

```text
evidence_subjects
evidence_witnesses
evidence_appeals
```

## Changed Tables

```text
evidence
  event_occurred_at
  submitted_mode
  backfill_reason
  backfilled_by
  quality_tier
```

```text
evidence_reviews
  conflict_disclosed
  conflict_reason
```

## Implementation Order

1. Apply migration 007.
2. Update TypeScript schema.
3. Update evidence submission flow to create default subject.
4. Add subject/witness add-buttons.
5. Add appeal command.
6. Add backfill command.
7. Add reviewer quality tier selection.
8. Add controls page filters.
