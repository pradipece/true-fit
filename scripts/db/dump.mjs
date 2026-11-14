#!/usr/bin/env node
/**
 * Snapshot the ESCO subset and the synthetic seeds from the database (Tiger Data, else
 * Supabase) to JSON, in the shape `yarn db:migrate --from <dir>` loads back:
 *
 *   yarn db:dump               # → db/snapshot/{esco,seed}/*.json (gitignored)
 *   yarn db:dump <dir>         # → <dir>/{esco,seed}/*.json
 *
 * The database is the source of truth; a snapshot is for backups, editing in bulk and
 * restoring. Scraped data is not included (re-run `yarn scrape` + `yarn db:migrate --scraped`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import pg from "pg";
import { dbConfig, missingDbEnv } from "../../lib/db-config.mjs";
import { readEsco, readSeed } from "../../lib/db-read.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const out = resolve(ROOT, process.argv[2] ?? "db/snapshot");
const target = dbConfig();
if (!target) {
  console.error(
    `No database is configured: set TIGER_DATABASE_URL, or ${missingDbEnv().join(", ")} for Supabase.`,
  );
  process.exit(1);
}

const client = new pg.Pool(target.config);
try {
  const [{ skills, occupations }, { companies, talent }] = await Promise.all([
    readEsco(client),
    readSeed(client),
  ]);
  const files = {
    "esco/skills.json": skills,
    "esco/occupations.json": occupations,
    "seed/companies.json": { companies },
    "seed/talent.json": { talent },
  };
  for (const [path, data] of Object.entries(files)) {
    mkdirSync(join(out, path, ".."), { recursive: true });
    writeFileSync(join(out, path), JSON.stringify(data, null, 2) + "\n");
  }
  console.log(
    `Dumped ${target.provider} → ${relative(ROOT, out) || "."}/: ${skills.skills.length} skills, ` +
      `${occupations.occupations.length} occupations, ${companies.length} companies, ${talent.length} talent`,
  );
} finally {
  await client.end();
}
