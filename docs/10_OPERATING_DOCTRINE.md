# Operating Doctrine

## Purpose

This is the social contract for Agency Terminal. It should be visible to members before the bot becomes active.

## Core statement

```text
Agency Terminal records contribution evidence. It does not independently determine rank, loyalty, trust, or authority.
```

## What the bot records

Agency Terminal may record:
```text
enlistment requests, contract requests, intel reports, performance evidence,
clearance requests, doctrine challenges, reviewer decisions, score events,
score corrections, appeals, audit events, ticket transcripts
```

## What the bot does not decide

Agency Terminal does not independently decide:
```text
who is valuable, who is loyal, who should be promoted, who should be demoted,
who should be trusted, who should be removed from the tribe,
who receives final political authority
```

## Human authority

Agency leadership, Handlers, Directors, and approved officers remain responsible for judgment.

The bot provides: structure, memory, evidence, auditability, review queues, profile summaries.

## Visibility

```text
public-safe profile metrics: member-visible after soft launch
intel metrics: officer-only
contract terms: officer-only
score reversals: director/officer-only
audit log: officer/director-only
```

## Appeals

Agents may appeal rejected or corrected evidence when they have:
```text
new evidence, procedural objection, wrong subject claim,
wrong metric claim, wrong point claim, reversal error claim
```

Repeated appeals may be marked final.

## Corrections

Agency Terminal does not silently edit contribution history.

If a credit was wrong: create reversal.
If a reversal was wrong: create correction/restoration.

## Backfill

If the bot is unavailable, officers may accept manual evidence and backfill it later. Backfilled records are marked as such.

## Doctrine challenges

Structured dissent is a contribution when it improves the tribe.

Adopted Doctrine Challenges generate ledger credit for the challenger.

Rejected challenges should be treated as insufficiently supported, not disloyal, unless they violate separate conduct rules.

## Member-facing summary

```text
Submit evidence.
Accept review.
Appeal with new facts.
Do not treat score as identity.
Do not treat the bot as leadership.
```

## Soft launch

Agency Terminal should not immediately become authoritative. The ledger must earn trust before it affects rank, access, or clearance decisions.

```text
Collect first. Calibrate second. Influence authority last.
```

See [Hosting Architecture](03_HOSTING_ARCHITECTURE.md) for launch phases: Dry Run → Shadow Ledger → Advisory Ledger → Operational Ledger.

## Red-team checklist

Before implementation and before launch, Agency Terminal should be reviewed adversarially:

### Enlistment
- How would a hostile recruit abuse enlistment?
- Can a rejected recruit see private rejection rationale?
- Can recruiters accidentally expose interview notes?
- Can applicants spam enlistment requests?

### Evidence
- How would someone farm easy points?
- How would someone submit forged screenshots?
- How would someone get friends to witness fake evidence?
- How would officers quietly favor friends?
- Can evidence be credited twice?
- Can group evidence over-credit participants?
- Can rejected evidence be appealed forever?

### Intel
- Can hostile alts infer who submits intel?
- Can public profiles reveal scout behavior?
- Can intel queues leak target systems?
- Can stale intel still look actionable?
- Can rejected intel reveal source patterns?

### Contracts
- Can public contract intake become spam?
- Can hostile groups bait operational details?
- Can fake clients create diplomatic incidents?
- Can payment terms leak?
- Can contract completion be disputed cleanly?

### Doctrine challenges
- Can doctrine challenges become drama channels?
- Can valid dissent be buried?
- Can adopted challenges fail to credit the challenger?
- Can rejected challenges be treated as disloyalty?

### Clearance
- Can the bot accidentally grant access?
- Can denial reasons leak?
- Can clearance requests reveal sensitive operations?
- Can old clearance requests remain visible too long?

### Operator / Maintainer
- Can the operator silently change point tables?
- Can records be edited without audit?
- Can exports be generated without trace?
- Can migrations break ledger history?

### Discord / Infra
- What happens if Discord API fails during validation?
- What happens if bot loses channel permissions?
- What happens if Railway restarts during score credit?
- What happens if Supabase is down?
- What happens if outbox events get stuck?

### Launch gate

Do not launch beyond shadow mode until each item has: accepted risk, mitigation, owner, test or operational check.

## Acceptance criteria

- This document is linked in README.
- This document is posted or summarized in Discord before launch.
- Soft launch does not begin until officers accept this doctrine.
- Red-team checklist is run before real deployment.
- Critical risks are documented with mitigations assigned and owners.
- Shadow mode begins only after top risks have owners.
