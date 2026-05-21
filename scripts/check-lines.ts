// scripts/check-lines.ts
// Enforces a maximum source file length of 400 lines.
// Excludes: tests, generated files, migrations.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_LINES = 400;
const ROOTS = ["apps", "packages", "scripts"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === ".git") return [];
      return walk(path);
    }
    return [path];
  });
}

const files = ROOTS.flatMap((root) => {
  if (!statSync(root).isDirectory()) return [];
  return walk(root);
}).filter((file) =>
  /\.(ts|tsx)$/.test(file) &&
  !file.includes(".test.") &&
  !file.includes("/generated/") &&
  !file.includes("\\generated\\") &&
  !file.includes("/migrations/") &&
  !file.includes("\\migrations\\"),
);

const failures = files
  .map((file) => ({ file, lines: readFileSync(file, "utf8").split("\n").length }))
  .filter((item) => item.lines > MAX_LINES);

if (failures.length > 0) {
  console.error("Files exceed line limit:");
  for (const failure of failures) {
    console.error(`  ${failure.file}: ${failure.lines} lines`);
  }
  process.exit(1);
} else {
  console.log(`check:lines OK — ${files.length} files within ${MAX_LINES} lines.`);
}
