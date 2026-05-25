# Phase 2.6.1 Controlled Shadow-Mode Acceptance Record

## Scope

Merged SHA tested: `50477a009356829460119e1bf10a3fc7b70f6f4e`

Environment: Kodaxa development Discord guild and disposable AgencyTerminal development PostgreSQL/Supabase infrastructure.

Purpose: validate reviewer integrity, private projection routing, quorum truthfulness, stale-alert routing smoke, and fail-closed ops-queue containment before deployment planning.

## Runtime policy verified

```env
NODE_ENV=production
AGENCY_OPS_QUEUE_CHANNEL_ID=<verified private development channel ID>
AGENCY_ALLOW_OPS_QUEUE_SETUP=false
```

No channel IDs, tokens, database URLs, or credentials are recorded here.

## Automated verification record

- `pnpm verify:migrations` passed for migrations `001` through `007`.
- Merged-main automated gates passed:
  - bot typecheck
  - bot tests: 65
  - root typecheck
  - root tests: 117
  - build
  - lint
  - line-count gate
  - diff check

## Controlled external acceptance results

Passed controls:

- Real slash-command receipt was ephemeral, stated recorded/queued, had no review controls, and had no public raw URL echo.
- Private reviewer projection delivered exactly once.
- Unauthorized review denied with no mutation.
- Self-review denied with `evidence_review_rejected` audit.
- Disclosed-conflict approval denied with `evidence_review_rejected` audit.
- Canonical quorum one-approval test validated correctly.
- Canonical quorum two-approval test remained under review after one approval.
- No automatic score-credit mutation was observed.
- Stale-alert private routing/deduplication smoke passed.
- Unsafe/missing configured queue failed closed, created no alternate queue, attempted no permission repair, emitted structured diagnostics, and left outbox delivery retryable.

## Evidence identifiers

- `EVD-0017` — conflict denial evidence.
- `EVD-0018` — stale-routing smoke evidence.
- `EVD-0019` — one-approval validation evidence.
- `EVD-0020` — two-approval truthfulness evidence.
- `EVD-0022` — real slash-receipt/privacy evidence.
- `EVD-0023` — self-review denial evidence.
- `EVD-0025` — fail-closed containment evidence.

## Caveats

- `EVD-0018` stale state was forced by direct update, so it proves alert routing/deduplication only, not ledger-mediated stale-state creation.
- An earlier containment attempt using `EVD-0024` was excluded because the running local bot processed it through the correct queue before the failure condition could be measured.
- Acceptance is valid for controlled development shadow-mode scope, not yet production or Agency-guild rollout.

## Decision and next gate

Phase 2.6.1 controlled shadow-mode acceptance: PASSED.

Before any production/Agency-guild deployment, require a separate deployment-readiness gate covering secrets/environment setup, persistent hosting/runtime process, logging/monitoring, database retention/cleanup, and an explicit rollback plan.
