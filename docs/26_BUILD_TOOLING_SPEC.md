# 26 — Build Tooling Spec

## Purpose

The docs referenced `pnpm check:lines` but did not define it. This document defines the command and minimum build gates.

## check:lines

`check:lines` enforces a maximum source file length.

Default limit:

```text
400 lines
```

Included paths:

```text
apps/**/src/**/*.{ts,tsx}
packages/**/src/**/*.{ts,tsx}
scripts/**/*.ts
```

Excluded paths:

```text
**/*.test.ts
**/*.test.tsx
**/generated/**
**/migrations/**
```

## Example Script

```ts
// scripts/check-lines.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_LINES = 400;
const ROOTS = ["apps", "packages", "scripts"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path);
    return [path];
  });
}

const files = ROOTS.flatMap((root) => walk(root)).filter((file) =>
  /\.(ts|tsx)$/.test(file) &&
  !file.includes(".test.") &&
  !file.includes("/generated/") &&
  !file.includes("/migrations/")
);

const failures = files
  .map((file) => ({ file, lines: readFileSync(file, "utf8").split("\n").length }))
  .filter((item) => item.lines > MAX_LINES);

if (failures.length > 0) {
  console.error("Files exceed line limit:");
  for (const failure of failures) {
    console.error(`${failure.file}: ${failure.lines}`);
  }
  process.exit(1);
}
```

## package.json

```json
{
  "scripts": {
    "check:lines": "tsx scripts/check-lines.ts",
    "typecheck": "tsc --noEmit",
    "test:run": "vitest run",
    "verify:migrations": "psql \"$DATABASE_URL\" -f packages/db/migrations/001_initial_agency_terminal.sql"
  }
}
```

## Acceptance Criteria

- `pnpm check:lines` has a real script.
- Generated files and migrations are excluded.
- Source files over 400 lines fail CI.
- Exceptions require documented justification.
