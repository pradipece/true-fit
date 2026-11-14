#!/usr/bin/env node
/**
 * Refreshes the ESCO-sourced fields of the cached taxonomy in data/esco/*.json
 * from the public ESCO API, keyed by each entry's `uri`. Curated fields
 * (id, label/group for skills, skills/extraTitles for occupations, keywords,
 * related) are left untouched.
 *
 *   node scripts/refresh-esco.mjs
 *
 * Only public taxonomy URIs are sent to the API — no personal data.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API = "https://ec.europa.eu/esco/api/resource";
const ROOT = fileURLToPath(new URL("../data/esco/", import.meta.url));
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
  const file = `${ROOT}skills.json`;
  const doc = JSON.parse(await readFile(file, "utf8"));
  await inBatches(doc.skills, async (s) => {
    const r = await get("skill", s.uri);
    s.escoLabel = r.preferredLabel?.en ?? s.escoLabel;
    s.labels = Object.fromEntries(["fi", "sv"].map((l) => [l, r.preferredLabel?.[l]]).filter(([, v]) => v));
    s.altLabels = clean(r.alternativeLabel?.en, 5);
  });
  doc.retrieved = new Date().toISOString().slice(0, 10);
  await writeFile(file, JSON.stringify(doc, null, 2) + "\n");
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
  const file = `${ROOT}occupations.json`;
  const doc = JSON.parse(await readFile(file, "utf8"));
  await inBatches(doc.occupations, async (o) => {
    const r = await get("occupation", o.uri);
    o.label = r.preferredLabel?.en ?? o.label;
    o.isco = await iscoOf(r);
    o.labels = Object.fromEntries(OCC_LANGS.map((l) => [l, r.preferredLabel?.[l]]).filter(([, v]) => v));
    o.altLabels = { en: clean(r.alternativeLabel?.en, 6), fi: clean(r.alternativeLabel?.fi, 4) };
  });
  doc.retrieved = new Date().toISOString().slice(0, 10);
  await writeFile(file, JSON.stringify(doc, null, 2) + "\n");
  console.log(`occupations: ${doc.occupations.length} refreshed`);
}

await refreshSkills();
await refreshOccupations();
