# Security and Privacy Model

## Data sensitivity levels

```ts
type Sensitivity =
  | "public"
  | "member"
  | "officer_only"
  | "director_only";
```

## High-risk data

- Intel reports
- Source identities
- Contract clients
- Payment terms
- Clearance denials
- Score reversals
- Doctrine disputes before adoption
- Private evidence attachments

## Permission model

Capabilities are mapped to Discord roles.

```ts
type Capability =
  | "can_view_all_tickets"
  | "can_validate_evidence"
  | "can_override_quorum"
  | "can_reverse_score"
  | "can_manage_clearance"
  | "can_manage_contracts"
  | "can_manage_intel"
  | "can_manage_config";
```

Never hardcode role names. Store mappings by guild.

## MVP automation restrictions

The bot must not automatically:

- Grant Discord roles
- Remove Discord roles
- Promote agents
- Demote agents
- Publish sensitive intel
- Accept contracts
- Reject enlistments
- Reverse score without review

## Audit requirements

Log all:

- Ticket creation
- Status changes
- Reviewer approvals/objections
- Quorum completion
- Director override
- Score credit
- Score reversal
- Clearance grant/denial
- Doctrine adoption/rejection
- Export events
