#!/usr/bin/env node
/**
 * Refreshes the ESCO-sourced fields of the ESCO subset in the database (esco_skills,
 * esco_occupations, esco_meta) from the public ESCO API, keyed by each entry's `uri`.
 * Curated fields (id, label/group for skills, skills/extraTitles for occupations,
 * keywords, related) are left untouched. Writes happen in one transaction.
 *
 *   yarn esco:refresh
 *
 * Only public taxonomy URIs are sent to the API — no personal data.
 */
import pg from "pg";
import { dbConfig, missingDbEnv } from "../lib/db-config.mjs";
import { readEsco } from "../lib/db-read.mjs";

const API = "https://ec.europa.eu/esco/api/resource";
const target = dbConfig();
if (!target) {
  console.error(
    `No database is configured: set TIGER_DATABASE_URL, or ${missingDbEnv().join(", ")} for Supabase.`,
  );
  process.exit(1);
}
const client = new pg.Client(target.config);
await client.connect();
const esco = await readEsco(client);
const today = new Date().toISOString().slice(0, 10);
const OCC_LANGS = ["en", "fi", "sv", "de", "fr", "es", "pt", "pl", "et", "uk", "ar"];

const clean = (list = [], n) =>
  [
    ...new Set(
      list
        .flatMap((s) => s.split(/\s{2,}/))
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, n);

async function get(kind, uri) {
  const res = await fetch(`${API}/${kind}?uri=${encodeURIComponent(uri)}&language=en`);
  if (!res.ok) throw new Error(`${kind} ${uri}: HTTP ${res.status}`);
  return res.json();
}

async function inBatches(items, fn, size = 8) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
}

async function refreshSkills() {
  const doc = esco.skills;
  await inBatches(doc.skills, async (s) => {
    const r = await get("skill", s.uri);
    s.escoLabel = r.preferredLabel?.en ?? s.escoLabel;
    s.labels = Object.fromEntries(["fi", "sv"].map((l) => [l, r.preferredLabel?.[l]]).filter(([, v]) => v));
    s.altLabels = clean(r.alternativeLabel?.en, 5);
  });
  for (const s of doc.skills)
    await client.query(`UPDATE esco_skills SET esco_label = $2, labels = $3, alt_labels = $4 WHERE id = $1`, [
      s.id,
      s.escoLabel,
      s.labels,
      s.altLabels,
    ]);
  await client.query(`UPDATE esco_meta SET retrieved = $1 WHERE dataset = 'skills'`, [today]);
  console.log(`skills: ${doc.skills.length} refreshed`);
}

/** ISCO-08 unit group; walks up broader occupations when the link is indirect. */
async function iscoOf(r, depth = 0) {
  const isco = r._links?.broaderIscoGroup?.[0];
  if (isco) return isco.code ?? isco.uri.split("/").pop().replace(/^C/, "");
  const parent = r._links?.broaderOccupation?.[0]?.uri;
  return parent && depth < 3 ? iscoOf(await get("occupation", parent), depth + 1) : null;
}

async function refreshOccupations() {
  const doc = esco.occupations;
  await inBatches(doc.occupations, async (o) => {
    const r = await get("occupation", o.uri);
    o.label = r.preferredLabel?.en ?? o.label;
    o.isco = await iscoOf(r);
    o.labels = Object.fromEntries(OCC_LANGS.map((l) => [l, r.preferredLabel?.[l]]).filter(([, v]) => v));
    o.altLabels = { en: clean(r.alternativeLabel?.en, 6), fi: clean(r.alternativeLabel?.fi, 4) };
  });
  for (const o of doc.occupations)
    await client.query(
      `UPDATE esco_occupations SET label = $2, isco = $3, labels = $4, alt_labels = $5 WHERE id = $1`,
      [o.id, o.label, o.isco, o.labels, o.altLabels],
    );
  await client.query(`UPDATE esco_meta SET retrieved = $1 WHERE dataset = 'occupations'`, [today]);
  console.log(`occupations: ${doc.occupations.length} refreshed`);
}

try {
  // Fetch everything first, then write in one transaction.
  await client.query("BEGIN");
  await refreshSkills();
  await refreshOccupations();
  await client.query("COMMIT");
  console.log(`Updated ${target.provider}. The app picks it up within the hour (cached), or on restart.`);
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ESCO refresh failed, rolled back:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
