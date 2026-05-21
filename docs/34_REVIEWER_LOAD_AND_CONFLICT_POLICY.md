# 34 — Reviewer Load and Conflict Policy

## Purpose

If the same officers validate everything, the Evidence Ledger becomes centralized and politically fragile. Agency Terminal needs minimal guardrails against reviewer overload and undisclosed conflicts.

## Reviewer Load

Track review counts by reviewer:

```text
reviews_last_7_days
reviews_last_30_days
pending_assigned_reviews
sensitive_reviews_last_30_days
```

Do not over-automate assignment in v1. Provide visibility first.

## Assignment Recommendation

When suggesting reviewers, sort by:

```text
has required capability
fewest pending assigned reviews
fewest reviews in last 7 days
not already a reviewer on this evidence
not marked conflict_disclosed for this evidence
```

## Conflict Disclosure

Reviewers may mark:

```text
conflict_disclosed = true
```

Conflict examples:

```text
same fleet
same contract team
same close ally
same dispute
same doctrine challenge
personal conflict
direct beneficiary
```

## Conflict Policy

v1 does not automatically block conflicted reviews. It records the disclosure.

Recommended rule:

```text
For high-value or sensitive evidence, at least one non-conflicted reviewer should approve.
```

## Schema Concept

```ts
type EvidenceReview = {
  evidenceId: string;
  reviewerDiscordId: string;
  decision: "approve" | "object" | "needs_more_evidence";
  rationale?: string;
  conflictDisclosed: boolean;
  conflictReason?: string;
};
```

## Controls Page

Evidence review page should show:

```text
Reviewer load
Conflict disclosed badge
Quorum status
Non-conflicted approvals count
```

## Acceptance Criteria

- Review records support conflict disclosure.
- Reviewer load is queryable.
- Assignment recommendations avoid overloading the same reviewers.
- High-value evidence can require a non-conflicted approval.
