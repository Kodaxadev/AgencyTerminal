# 35 — Evidence Quality Tiers

## Purpose

Validation should not treat all accepted evidence as equally strong. The system needs a simple quality tier that helps reviewers and leadership distinguish verifiability.

## Quality Tiers

```ts
type EvidenceQualityTier = "A" | "B" | "C" | "D" | "F";
```

| Tier | Meaning | Typical handling |
|---|---|---|
| A | Independently verifiable | Strongest evidence |
| B | Strong screenshot/link/witness support | Usually acceptable |
| C | Plausible but weakly corroborated | May need additional review |
| D | Insufficient | Reject or request more evidence |
| F | False/forged | Reject, possible incident review |

## Examples

```text
A: API/world-verifiable event, reliable killboard record, transaction digest
B: screenshot + witness, Discord operation log + officer confirmation
C: verbal claim, partial screenshot, unclear timestamp
D: no evidence, unrelated screenshot, unverifiable claim
F: altered screenshot, knowingly false claim, impersonated source
```

## Score Relationship

Quality tier does not automatically change points in v1.

Recommended:

```text
A/B can be credited normally.
C requires reviewer judgment.
D receives no credit.
F receives no credit and may trigger incident review.
```

## UX

Reviewer must choose a quality tier when validating or rejecting evidence.

Validation embed:

```text
EVIDENCE QUALITY: B
VALIDATION: APPROVED
QUORUM: 2/2
```

## Acceptance Criteria

- Evidence records support quality tier.
- Reviewer UI captures tier.
- F-tier evidence is auditable and visible to directors.
- Quality does not auto-mutate score in v1.
