#!/usr/bin/env node
/**
 * Scrapes public recruitment-related data (jobs, events, public services,
 * reference pages) into data/scraped/<source>.json, plus a _manifest.json.
 *
 *   yarn scrape                       # all sources
 *   yarn scrape thehub espoo-events   # only these
 *   yarn scrape --list                # list sources and skipped ones
 *   yarn scrape --limit 50            # max items per source (default 500)
 *   yarn scrape --no-details          # The Hub: skip per-job description pages
 *   yarn scrape --since 2025-01-01    # events starting from this date (default: 1 year ago)
 *
 * Polite by design: honours robots.txt, one request per second per host
 * (SCRAPE_INTERVAL_MS), retries with back-off. Sources run in parallel since
 * they hit different hosts. Personal contact fields are not stored.
 *
 * The output is real third-party content: it is gitignored and is for research
 * and taxonomy work only. The demo itself keeps running on synthetic data.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { USER_AGENT } from "./lib.mjs";
import { SKIPPED, SOURCES } from "./sources.mjs";

const OUT = fileURLToPath(new URL("../../data/scraped/", import.meta.url));

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const optValues = new Set(
  ["--limit", "--since"].flatMap((f) => (args.includes(f) ? [args[args.indexOf(f) + 1]] : [])),
);
const names = args.filter((a) => !a.startsWith("--") && !optValues.has(a));

if (flag("list") || flag("help")) {
  console.log("Sources:");
  for (const [k, s] of Object.entries(SOURCES)) console.log(`  ${k.padEnd(20)} ${s.title}`);
  console.log("\nNot scraped:");
  for (const [k, s] of Object.entries(SKIPPED)) console.log(`  ${k.padEnd(20)} ${s.reason}`);
  process.exit(0);
}

const unknown = names.filter((n) => !SOURCES[n]);
if (unknown.length) {
  const why = unknown.map((n) => (SKIPPED[n] ? `${n}: ${SKIPPED[n].reason}` : `${n}: unknown source`));
  console.error(why.join("\n"));
  process.exit(1);
}

const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
const ctx = {
  limit: Number(opt("limit", 500)),
  details: !flag("no-details"),
  since: opt("since", yearAgo),
};
const selected = names.length ? names : Object.keys(SOURCES);

await mkdir(OUT, { recursive: true });

async function runSource(key) {
  const src = SOURCES[key];
  const log = (msg) => console.log(`[${key}] ${msg}`);
  const started = Date.now();
  log(`start: ${src.title}`);
  try {
    const { items, failed = 0, extra } = await src.run({ ...ctx, log });
    const doc = {
      source: key,
      title: src.title,
      origin: src.origin,
      kind: src.kind,
      notes: src.notes,
      retrieved: new Date().toISOString(),
      count: items.length,
      failed,
      ...(extra && { extra }),
      items,
    };
    await writeFile(`${OUT}${key}.json`, JSON.stringify(doc, null, 2) + "\n");
    log(
      `done: ${items.length} items${failed ? `, ${failed} failed` : ""} in ${((Date.now() - started) / 1000).toFixed(0)} s`,
    );
    return { status: "ok", count: items.length, failed, file: `data/scraped/${key}.json` };
  } catch (err) {
    log(`FAILED: ${err.message}`);
    return { status: "error", error: err.message };
  }
}

const results = Object.fromEntries(await Promise.all(selected.map(async (k) => [k, await runSource(k)])));

// Merge with the previous manifest so partial runs keep earlier results.
let previous = {};
try {
  previous = JSON.parse(await readFile(`${OUT}_manifest.json`, "utf8")).sources ?? {};
} catch {
  /* first run */
}
const manifest = {
  updated: new Date().toISOString(),
  userAgent: USER_AGENT,
  options: ctx,
  sources: {
    ...previous,
    ...Object.fromEntries(
      Object.entries(results).map(([k, r]) => [
        k,
        { title: SOURCES[k].title, ...r, at: new Date().toISOString() },
      ]),
    ),
  },
  skipped: SKIPPED,
};
await writeFile(`${OUT}_manifest.json`, JSON.stringify(manifest, null, 2) + "\n");

const failed = Object.entries(results).filter(([, r]) => r.status !== "ok");
console.log(`\n${selected.length - failed.length}/${selected.length} sources OK → data/scraped/`);
if (failed.length) process.exitCode = 1;
