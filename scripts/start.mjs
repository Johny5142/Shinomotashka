import { spawnSync } from "node:child_process";
const migration = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/migrate.ts"],
  { stdio: "inherit" },
);
if (migration.status !== 0) process.exit(migration.status || 1);
await import("../dist/server/entry.mjs");
