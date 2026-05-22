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
  - Workflow instance creation

Review Module
  - Assignments
  - Quorum votes
  - Objections
  - Timeout escalation
  - Director overrides
  - Conflict disclosure
  - Evidence quality tier selection

Evidence Ledger
  - Evidence records (with short IDs: EVD-NNNN)
  - Evidence subjects (group credit)
  - Evidence witnesses
  - Evidence links
  - Review records (with conflict disclosure)
  - Quality tiers (A/B/C/D/F)
  - Score events
  - Score reversals
  - Score corrections
  - Appeals
  - Backfill/import records

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
  - Contribution credit on adoption

Integration Module
  - Killboard links (manual URL, v1)
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
  -> Evidence Ledger (score credit on adoption)

Integration Module
  -> reads Evidence Ledger
  -> writes external references back to Evidence Ledger
```

## Source of truth rule

Discord is the workflow UI. Postgres is the source of truth.

Discord messages, embeds, and channels can be deleted or reorganized. The ledger must remain canonical.

## EVE Frontier boundary

v1 supports manual character name, wallet address, system name, smart object ID, killboard/evidence URL, transaction digest, and EF-Map links.

v1 does not require World API lookup, killboard parsing, wallet login, zkLogin, on-chain writes, in-game browser context, Smart Assembly control, or Smart Gate policy mutation.

Every external integration must sit behind an adapter:

```ts
type ExternalEvidenceAdapter = {
  source: "ef_map" | "world_api" | "signal_vault" | "frontierwarden";
  canResolve(input: string): boolean;
  resolve(input: string): Promise<ResolvedExternalEvidence>;
};
```

The core evidence ledger must not import SDKs directly. If an external lookup fails, store the submitted value, mark `parsed = false`, allow manual review, and show the failure in reviewer UI. Never invent system IDs, kill values, wallet ownership, character ownership, tribe membership, or contract completion.

## Error handling and reliability

Postgres is the source of truth. Discord messages are projections. A failed Discord message update should create a retryable outbox event, not roll back the ledger.

Failure classes:
| Failure | Strategy |
|---|---|
| Discord rate limit (429) | Respect `retry_after`, exponential backoff with jitter |
| Discord transient (500/502/503/504) | Retry with backoff |
| Discord permission error (403) | Mark config unhealthy, do not retry blindly |
| Discord missing resource (404) | Mark projection stale, alert ops |
| Database conflict | Return deterministic user response |
| Database unavailable | Fail closed; do not fake success |

Default retry policy:
```ts
type RetryPolicy = {
  maxAttempts: 5;
  baseDelayMs: 500;
  maxDelayMs: 30_000;
  jitter: true;
  retryOnStatus: [429, 500, 502, 503, 504];
  failFastOnStatus: [401, 403, 404];
};
```

Backoff: `delay = min(maxDelayMs, baseDelayMs * 2 ** attempt) + random(0, 250)`

For HTTP 429, Discord's returned `retry_after` overrides the computed delay.

### Idempotency

Every state-changing action has a deterministic idempotency key:

| Action | Idempotency key |
|---|---|
| Create ticket | `ticket:create:{guildId}:{interactionId}` |
| Add evidence review | `review:{evidenceId}:{reviewerDiscordId}` |
| Credit score | `score:credit:{evidenceId}:{agentDiscordId}` |
| Reverse score | `score:reverse:{scoreEventId}` |
| Post stale alert | `stale-alert:{evidenceId}` |
| Export transcript | `transcript:{ticketId}` |

### Transaction boundary (validation + score credit)

```text
1. Begin DB transaction
2. Insert evidence review
3. Recalculate quorum
4. If quorum reached, update evidence status
5. Insert agent_score_event if applicable
6. Insert audit_log row
7. Insert Discord outbox event
8. Commit
9. Process outbox event asynchronously
```

## Repo structure and naming

```text
agency-terminal/
├─ apps/
│  ├─ bot/
│  └─ controls/
├─ packages/
│  ├─ core/        (evidence, tickets, scoring, permissions, retention)
│  ├─ db/          (migrations, schema)
│  ├─ discord-ui/  (embeds, buttons)
│  └─ config/
├─ docs/
├─ scripts/
└─ package.json
```

No generic SaaS names (tenant, customer, subscription, plan, billing, workspace). Prefer: guild, agency, handler, director, evidence, ledger, clearance, doctrine. `guild_id` is acceptable because Discord uses that term.

## Schema

SQL migrations are the canonical source:

```
packages/db/migrations/
  001_initial_agency_terminal.sql
  002_retention_and_transcripts.sql
  003_operational_tables.sql
  004_workflow_state_machines_and_short_ids.sql
  005_score_corrections_and_contract_details.sql
  006_capability_scope_patch.sql
  007_group_credit_appeals_backfill.sql
```

Drizzle schema sketch for reference: `packages/db/schema/drizzle-schema.ts`.

## Build gates

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
pnpm check:lines    # 400 line max per source file (excl. tests, generated, migrations)
pnpm verify:migrations
```

File size limit: 400 lines per source file. Exceptions require documented justification.

## Failure modes and abuse mitigations

| Attack/failure | Mitigation |
|---|---|
| Evidence spam | Per-user rate limits, needs_more_evidence, duplicate status |
| Favoritism through validation | Quorum for sensitive metrics, audit all reviews, stale escalation |
| Retaliatory score reversal | Director + corroborating officer, mandatory reason, audit log |
| Intel exposure via profile | Metric visibility config, officer-only intel details |
| Contract client leak | Contract tickets default officer_only, retention/redaction |
| Doctrine challenge weaponization | Structured fields, evidence requirement, review status |
| Bot permission drift | Controls health check, startup self-check, config unhealthy state |
| Duplicate button clicks | Unique evidence review per reviewer, idempotency keys, unique reversal per score event |
| External evidence forgery | Manual review, source type field, parsed=false until resolver succeeds |
| Operator becomes silent authority | All controls changes write audit_log, maintenance scripts write audit_log |

MVP rate limits:
```text
evidence submissions: 5 per user per hour
intel reports: 5 per user per hour
doctrine challenges: 2 per user per day
contract submissions: 3 per user per hour
enlistment: 1 open enlistment per user
```
