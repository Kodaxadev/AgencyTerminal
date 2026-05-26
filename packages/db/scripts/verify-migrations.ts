#!/usr/bin/env tsx
/**
 * verify:migrations — runs all SQL migrations in order against DATABASE_URL
 * and asserts each completes without error.
 *
 * Usage: pnpm --filter @agency-terminal/db verify:migrations
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

async function main(): Promise<void> {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not set");
    process.exit(1);
  }

  const migrationsDir = join(process.cwd(), "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.error("ERROR: No migration files found");
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { max: 1 });

  let applied = 0;
  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const content = readFileSync(filePath, "utf-8");
    try {
      await sql.unsafe(content);
      console.log(`  OK  ${file}`);
      applied++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL ${file}: ${message}`);
      await sql.end();
      process.exit(1);
    }
  }

  await sql.end();
  console.log(`\nAll ${applied} migration(s) applied successfully.`);
}

void main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`ERROR: ${message}`);
  process.exit(1);
});
