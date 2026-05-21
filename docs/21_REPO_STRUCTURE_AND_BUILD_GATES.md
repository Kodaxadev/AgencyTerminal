# 21 — Repo Structure and Build Gates

## Purpose

Keep Agency Terminal small, maintainable, and tribe-specific.

## Recommended Repo Structure

```text
agency-terminal/
├─ apps/
│  ├─ bot/
│  │  ├─ src/
│  │  │  ├─ commands/
│  │  │  ├─ interactions/
│  │  │  ├─ modals/
│  │  │  ├─ jobs/
│  │  │  └─ index.ts
│  │  └─ package.json
│  └─ controls/
│     ├─ src/
│     │  ├─ routes/
│     │  ├─ components/
│     │  ├─ api/
│     │  └─ main.tsx
│     └─ package.json
├─ packages/
│  ├─ core/
│  │  ├─ src/
│  │  │  ├─ evidence/
│  │  │  ├─ tickets/
│  │  │  ├─ scoring/
│  │  │  ├─ permissions/
│  │  │  └─ retention/
│  ├─ db/
│  │  ├─ migrations/
│  │  ├─ src/
│  │  └─ schema/
│  ├─ discord-ui/
│  │  ├─ src/
│  │  │  ├─ embeds/
│  │  │  └─ buttons/
│  └─ config/
├─ docs/
├─ scripts/
└─ package.json
```

## Naming Rule

No generic SaaS names:

Avoid:

```text
tenant
customer
subscription
plan
billing
workspace
organization onboarding
```

Prefer:

```text
guild
agency
handler
director
evidence
ledger
clearance
doctrine
```

Technical note: `guild_id` is acceptable because Discord uses that term.

## Build Gates

Required commands:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
pnpm check:lines
pnpm verify:migrations
```

## Test Targets

### Core

```text
evidence quorum
stale escalation
score credit idempotency
score reversal policy
metric visibility
permission checks
retention dry-run
```

### Bot

```text
slash command registration
modal validation
button idempotency
permission denied responses
Discord retry wrapper
```

### Controls

```text
server-side permission checks
health page
role mapping update audit
metric config versioning
retention dry-run confirmation
```

## File Size

Default limit:

```text
400 lines per source file
```

Exceptions require a comment in PR:

```text
Why this file exceeds limit
Plan to split later
```

## Acceptance Criteria

- Core business logic does not import Discord SDK.
- Controls page does not directly mutate DB without service functions.
- Bot command handlers stay thin.
- Migrations are tested on fresh DB.
- No SaaS language appears in README or UI.
