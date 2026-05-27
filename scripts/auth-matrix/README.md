# Authorization matrix simulator

Drives the deployed Controls API as eight synthetic seats — one per capability
under test — without needing real Discord accounts. Plants a real signed
session into the production `controls_sessions` table for each seat, hits the
live endpoints with the matching signed cookie, asserts row visibility,
then deletes the planted sessions.

This is the same matrix described in [docs/AUTHORIZATION_MATRIX.md](../../docs/AUTHORIZATION_MATRIX.md),
just runnable without provisioning eight Discord identities.

## What this proves and what it skips

**Identical to a Discord-authenticated request:**
- Cookie signing/verification via `CONTROLS_SESSION_SECRET`.
- Session lookup against the production `controls_sessions` table (with token
  decryption via `CONTROLS_TOKEN_ENCRYPTION_SECRET`).
- Page-level access decision (`canAccessPath`).
- Repository row filtering (`canViewEvidenceRow`, `canViewTicketRow`).
- Export per-type authorization and per-record filtering.

**Skipped vs. real Discord OAuth:**
- The Discord OAuth handshake itself.
- The session-refresh path that re-fetches Discord guild member roles every
  5 minutes. The simulator sets `validatedAt = now`, so the matrix has a
  5-minute window before any request triggers a Discord roundtrip with the
  fake access token. The whole matrix completes in seconds.

Net: this verifies the deployed authorization code with bit-identical session
state to a real signed-in user.

## Prerequisites

1. Seed the fixture rows once:
   ```bash
   psql "$DATABASE_URL" -f scripts/fixtures/authorization_matrix.sql
   ```
2. Pull production secrets to a local env file:
   ```bash
   vercel link              # if not already linked (links to project atcc)
   vercel env pull --environment=production .env.production.local
   ```
   That produces a file containing `DATABASE_URL`, `CONTROLS_SESSION_SECRET`,
   `CONTROLS_TOKEN_ENCRYPTION_SECRET`, `CONTROLS_PUBLIC_BASE_URL`, and others.
3. Confirm `CONTROLS_PUBLIC_BASE_URL` is set to the production controls URL
   (e.g. `https://atcc.vercel.app`). The simulator hits `${baseUrl}/api/...`.

## Run

PowerShell:
```powershell
$env:DOTENV = ".env.production.local"
Get-Content $env:DOTENV | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"]*)"?\s*$') { Set-Item "env:$($Matches[1])" $Matches[2] }
}
pnpm exec tsx scripts/auth-matrix/run.ts
```

bash / zsh:
```bash
set -a; source .env.production.local; set +a
pnpm exec tsx scripts/auth-matrix/run.ts
```

Exit code:
- `0` — every check passed.
- `1` — at least one check failed; the failing seat/path/expectation prints to stderr.
- `2` — fatal (missing env, network, DB).

## After

The simulator deletes its own planted sessions on every run, including failure
paths via `try/finally` — but if the script is killed mid-run, you can sweep
leftovers manually:

```sql
DELETE FROM controls_sessions
WHERE user->>'id' LIKE 'matrix-seat-%';
```

The fixture rows in `evidence` and `tickets` are left in place between runs so
the matrix is repeatable. When the verification is done:

```bash
psql "$DATABASE_URL" -f scripts/fixtures/authorization_matrix_cleanup.sql
```

## Adding new seats or checks

Edit the `SEATS` and `CHECKS` arrays in [run.ts](run.ts). Each seat holds an
array of capabilities; each check is `{ seat, path, expectStatus, mustInclude?,
mustExclude? }`. `mustInclude` and `mustExclude` are substring matches against
the response body — for JSON endpoints the simplest needles are row titles
(`MATRIX_TEST_*`) or export-descriptor type strings.

## Why this isn't a code backdoor

The script writes session rows directly to the database from outside the server
process. It does **not** add any auth-bypass path to the deployed code. A
compromised attacker who could call this script would already have:

- Direct database write access (`DATABASE_URL`).
- The session-signing secret (`CONTROLS_SESSION_SECRET`).
- The token-encryption secret (`CONTROLS_TOKEN_ENCRYPTION_SECRET`).

Anyone holding that trio could already authenticate as anyone. The script
only automates what those credentials already permit — it doesn't create a new
attack surface in the deployed code.
