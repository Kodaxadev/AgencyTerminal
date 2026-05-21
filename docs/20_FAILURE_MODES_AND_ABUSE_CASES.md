# 20 — Failure Modes and Abuse Cases

## Purpose

Agency Terminal handles status, credit, access, and dissent. Those are social attack surfaces. This document identifies likely failures and sets mitigations.

## Abuse Cases

### 1. Evidence Spam

Attack:

```text
Agent submits many low-quality evidence tickets to overwhelm reviewers.
```

Mitigations:

```text
per-user submission rate limits
needs_more_evidence status
duplicate status
reviewer bulk close for obvious spam
audit spam closure
```

### 2. Favoritism Through Validation

Attack:

```text
Officer validates friend contributions and ignores others.
```

Mitigations:

```text
quorum for sensitive metrics
audit all reviews
stale review escalation
profile shows pending vs credited counts to officers
director review of validation patterns
```

### 3. Retaliatory Score Reversal

Attack:

```text
Director/officer reverses score due to politics.
```

Mitigations:

```text
director + corroborating officer required
mandatory reason
audit log
affected agent notification option
reversal visible in officer full profile
```

### 4. Intel Exposure

Attack:

```text
Hostile or untrusted member uses /profile to identify intel contributors.
```

Mitigations:

```text
metric visibility config
officer-only intel details
public profile hides intelligence acquisitions by default
```

### 5. Contract Client Leak

Attack:

```text
Contract terms or client identity leaks through broad channel visibility.
```

Mitigations:

```text
contract tickets default officer_only
client fields not shown in public queue
contract export requires permission
retention/redaction policy
```

### 6. Doctrine Challenge Weaponization

Attack:

```text
Challenge system becomes a drama amplifier.
```

Mitigations:

```text
structured fields
evidence requirement
review status
rejected_insufficient_evidence option
adopted changes summarized, not full drama reposted
```

### 7. Bot Permission Drift

Attack/failure:

```text
Discord roles/channels change and bot silently loses ability to post logs.
```

Mitigations:

```text
controls health check
startup self-check
config unhealthy state
admin channel warning if possible
```

### 8. Duplicate Button Clicks

Attack/failure:

```text
Repeated review clicks duplicate score credit.
```

Mitigations:

```text
unique evidence review per reviewer
idempotency keys
unique reversal per score event
transactional score credit
```

### 9. External Evidence Forgery

Attack:

```text
User submits fake screenshot, edited link, or unverified killboard claim.
```

Mitigations:

```text
manual review
source type field
parsed=false until resolver succeeds
reviewer rationale required
corroboration for high-value evidence
```

### 10. Operator Becomes Silent Authority

Attack/failure:

```text
Bot maintainer changes points, roles, or records without visibility.
```

Mitigations:

```text
all controls page changes write audit_log
maintenance scripts write audit_log
exports include exported_by
no hidden admin-only mutations
```

## Rate Limits

MVP defaults:

```text
evidence submissions: 5 per user per hour
intel reports: 5 per user per hour
doctrine challenges: 2 per user per day
contract submissions: 3 per user per hour
enlistment: 1 open enlistment per user
```

Rate limits should be configurable but not exposed to ordinary users.

## Failure State Language

Use explicit, non-ambiguous status:

```text
STATUS // CODE 409 // DUPLICATE
STATUS // CODE 422 // INSUFFICIENT EVIDENCE
STATUS // CODE 429 // RATE LIMITED
STATUS // CODE 503 // TEMPORARY FAILURE
```

## Acceptance Criteria

- Bot prevents duplicate score credit.
- Bot rate-limits user submissions.
- Sensitive metrics are hidden from public profile.
- Contract tickets default to restricted visibility.
- Reversals are more protected than validations.
- Bot health detects permission drift.
