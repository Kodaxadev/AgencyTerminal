# 36 — Negative Evidence Boundary

## Purpose

Agency Terminal is a contribution ledger, not a punishment engine. Negative evidence must be handled carefully to avoid turning the bot into a political weapon.

## Decision

v1 does not create negative public score.

Allowed:

```text
incident tickets
evidence rejection
false/forged quality tier
score reversal
director-only notes
clearance review records
```

Forbidden in v1:

```text
negative public points
public shame score
automatic demotion
automatic role removal
automatic blacklist
public misconduct profile
```

## Incident Tickets

If behavior needs review, use a restricted incident/general ticket.

Incident records default to:

```text
director_only
```

or:

```text
officer_only
```

depending on severity.

## Relationship to Evidence Ledger

Rejected evidence remains part of the evidence record.

Forged evidence may create:

```text
incident ticket
audit log
director-only note
```

but should not automatically produce a public negative score.

## Why

A negative scoring system changes the product from:

```text
contribution ledger
```

to:

```text
disciplinary reputation system
```

That is a different governance problem and should require a new ADR.

## Acceptance Criteria

- No negative score events in v1.
- Reversals remove/restoratively correct credit; they do not create public punishment.
- Incident handling is restricted visibility.
- Any future negative reputation feature requires new ADR.
