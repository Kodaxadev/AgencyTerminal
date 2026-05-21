# 37 — Red-Team Checklist

## Purpose

Before implementation and before launch, Agency Terminal should be reviewed adversarially.

## Enlistment

```text
How would a hostile recruit abuse enlistment?
Can a rejected recruit see private rejection rationale?
Can recruiters accidentally expose interview notes?
Can applicants spam enlistment requests?
```

## Evidence

```text
How would someone farm easy points?
How would someone submit forged screenshots?
How would someone get friends to witness fake evidence?
How would officers quietly favor friends?
Can evidence be credited twice?
Can group evidence over-credit participants?
Can rejected evidence be appealed forever?
```

## Intel

```text
Can hostile alts infer who submits intel?
Can public profiles reveal scout behavior?
Can intel queues leak target systems?
Can stale intel still look actionable?
Can rejected intel reveal source patterns?
```

## Contracts

```text
Can public contract intake become spam?
Can hostile groups bait operational details?
Can fake clients create diplomatic incidents?
Can payment terms leak?
Can contract completion be disputed cleanly?
```

## Doctrine Challenges

```text
Can doctrine challenges become drama channels?
Can valid dissent be buried?
Can adopted challenges fail to credit the challenger?
Can rejected challenges be treated as disloyalty?
```

## Clearance

```text
Can the bot accidentally grant access?
Can denial reasons leak?
Can clearance requests reveal sensitive operations?
Can old clearance requests remain visible too long?
```

## Operator / Maintainer

```text
Can the operator silently change point tables?
Can records be edited without audit?
Can exports be generated without trace?
Can migrations break ledger history?
```

## Discord / Infra

```text
What happens if Discord API fails during validation?
What happens if bot loses channel permissions?
What happens if Railway restarts during score credit?
What happens if Supabase is down?
What happens if outbox events get stuck?
```

## Launch Gate

Do not launch beyond shadow mode until each item has:

```text
accepted risk
mitigation
owner
test or operational check
```

## Acceptance Criteria

- Red-team checklist is run before real deployment.
- Critical risks are documented.
- Mitigations are assigned.
- Shadow mode begins only after top risks have owners.
