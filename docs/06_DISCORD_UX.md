# Discord UX Specification

## Channel architecture

```text
AGENCY TERMINAL
├─ #terminal-start
├─ #ticket-create
├─ #public-contract-intake
├─ #enlistment-protocol
├─ #terminal-status

AGENCY OPS
├─ #ops-queue
├─ #contract-board
├─ #intel-review
├─ #clearance-review
├─ #evidence-review
├─ #audit-log

ARCHIVES
├─ #closed-contracts
├─ #validated-evidence
├─ #doctrine-changes
├─ #archived-tickets
```

## Commands

User commands:

```text
/enlist start
/contract submit
/intel report
/evidence submit
/clearance request
/doctrine challenge
/profile @agent
```

Officer commands:

```text
/ticket assign
/ticket status
/ticket close
/ticket transcript
/review approve
/review object
/review request-evidence
/evidence credit
/evidence reverse
/profile @agent --full
```

Admin commands:

```text
/agency config
/agency config points
/agency role-map
/agency export ledger
/agency register-commands
```

## Embed language

Accepted:

```text
SIG//AGENCY TERMINAL
STATUS // CODE 200 // ACCEPTED
CLEARANCE: GRANTED
```

Rejected:

```text
SIG//AGENCY TERMINAL
STATUS // CODE 403 // REJECTED
INSUFFICIENT EVIDENCE
```

Archived:

```text
STATUS // CODE 204 // ARCHIVED
NO FURTHER ACTION REQUIRED
```

Stale review:

```text
STATUS // CODE 408 // REVIEW TIMEOUT
[ STALE — NEEDS RESOLUTION ]
```

## Profile views

Public:

```text
/profile @agent
```

Officer-only:

```text
/profile @agent --full
```

Intel metrics and sensitive clearance records should default to officer-only.
