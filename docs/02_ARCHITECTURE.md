# Agency Terminal Architecture

## High-level topology

```text
Discord Server
  -> Railway Bot Worker
    -> Supabase Postgres
    -> Supabase Storage
  -> Vercel Dashboard later
```

## Internal modules

```text
Intake Module
  - Slash commands
  - Discord modals
  - Ticket channel creation
  - Form validation

Review Module
  - Assignments
  - Quorum votes
  - Objections
  - Timeout escalation
  - Director overrides

Evidence Ledger
  - Evidence records
  - Evidence links
  - Review records
  - Score events
  - Score reversals

Clearance Module
  - Requests
  - Grants/denials
  - Expirations
  - Revocations

Doctrine Module
  - Challenges
  - Discussion records
  - Adoption/rejection
  - Doctrine-change posts
  - Contribution credit

Integration Module
  - Killboard links
  - Signal Vault references later
  - FrontierWarden references later
  - World API references later
```

## Dependency map

```text
Intake Module
  -> Review Module
    -> Evidence Ledger
      -> Agent Profile

Review Module
  -> Clearance Module

Doctrine Module
  -> #doctrine-changes
  -> Evidence Ledger

Integration Module
  -> reads Evidence Ledger
  -> writes external references back to Evidence Ledger
```

## Source of truth rule

Discord is the workflow UI. Postgres is the source of truth.

Discord messages, embeds, and channels can be deleted or reorganized. The ledger must remain canonical.
