#!/usr/bin/env node
/**
 * Load the JSON data in data/ into Tiger Data (Postgres) at TIGER_DATABASE_URL.
 *
 *   yarn db:migrate              # schema + ESCO subset + synthetic seeds + scraped data
 *   yarn db:migrate --no-scraped # skip data/scraped (real third-party pages)
 *
 * Idempotent: creates missing tables from db/schema.sql, then replaces every table's
 * contents in one transaction, so a failed run leaves the database unchanged.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const withScraped = !process.argv.includes("--no-scraped");

const url = process.env.TIGER_DATABASE_URL;
if (!url) {
  console.error("TIGER_DATABASE_URL is not set (add it to .env or .env.local).");
  process.exit(1);
}

/** Bulk insert: rows go in as one JSON array parameter and are expanded server-side. */
async function insert(db, table, columns, rows) {
  if (!rows.length) return 0;
  const cols = Object.keys(columns);
  const defs = cols.map((c) => `${c} ${columns[c]}`).join(", ");
  for (let i = 0; i < rows.length; i += 500) {
    await db.query(
      `INSERT INTO ${table} (${cols.join(", ")}) SELECT ${cols.join(", ")} FROM jsonb_to_recordset($1::jsonb) AS r(${defs})`,
      [JSON.stringify(rows.slice(i, i + 500))],
    );
  }
  return rows.length;
}

const skillsJson = read("data/esco/skills.json");
const occupationsJson = read("data/esco/occupations.json");
const { companies } = read("data/seed/companies.json");
const { talent } = read("data/seed/talent.json");

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
const counts = {};
try {
  await db.query("BEGIN");
  await db.query(readFileSync(join(ROOT, "db/schema.sql"), "utf8"));
  await db.query(`TRUNCATE esco_meta, esco_skills, esco_skill_relations, esco_occupations, esco_occupation_skills,
    companies, needs, need_skills, talent, talent_skills, talent_evidence, talent_languages, talent_audit
    ${withScraped ? ", scraped_sources, scraped_items" : ""} CASCADE`);

  // ESCO
  counts.esco_meta = await insert(
    db,
    "esco_meta",
    { dataset: "text", source: "text", licence: "text", retrieved: "text" },
    [
      { dataset: "skills", ...pick(skillsJson, "source", "licence", "retrieved") },
      { dataset: "occupations", ...pick(occupationsJson, "source", "licence", "retrieved") },
    ],
  );
  counts.esco_skills = await insert(
    db,
    "esco_skills",
    {
      id: "text",
      label: "text",
      skill_group: "text",
      uri: "text",
      match: "text",
      esco_label: "text",
      keywords: "text[]",
      labels: "jsonb",
      alt_labels: "text[]",
    },
    skillsJson.skills.map((s) => ({
      id: s.id,
      label: s.label,
      skill_group: s.group,
      uri: s.uri ?? null,
      match: s.match ?? null,
      esco_label: s.escoLabel ?? null,
      keywords: s.keywords ?? [],
      labels: s.labels ?? {},
      alt_labels: s.altLabels ?? [],
    })),
  );
  counts.esco_skill_relations = await insert(
    db,
    "esco_skill_relations",
    { skill_id: "text", related_id: "text", weight: "real" },
    skillsJson.related.map(([skill_id, related_id, weight]) => ({ skill_id, related_id, weight })),
  );
  const occs = occupationsJson.occupations;
  counts.esco_occupations = await insert(
    db,
    "esco_occupations",
    {
      id: "text",
      uri: "text",
      label: "text",
      isco: "text",
      labels: "jsonb",
      alt_labels: "jsonb",
      extra_titles: "text[]",
    },
    occs.map((o) => ({
      id: o.id,
      uri: o.uri,
      label: o.label,
      isco: o.isco ?? null,
      labels: o.labels ?? {},
      alt_labels: o.altLabels ?? {},
      extra_titles: o.extraTitles ?? [],
    })),
  );
  counts.esco_occupation_skills = await insert(
    db,
    "esco_occupation_skills",
    { occupation_id: "text", skill_id: "text", position: "int" },
    occs.flatMap((o) =>
      (o.skills ?? []).map((skill_id, position) => ({ occupation_id: o.id, skill_id, position })),
    ),
  );

  // Seeds
  counts.companies = await insert(
    db,
    "companies",
    { id: "text", name: "text", blurb: "text", sector: "text", location: "text" },
    companies.map((c) => pick(c, "id", "name", "blurb", "sector", "location")),
  );
  const needs = companies.flatMap((c) => c.needs.map((n) => ({ ...n, companyId: c.id })));
  counts.needs = await insert(
    db,
    "needs",
    {
      id: "text",
      company_id: "text",
      title: "text",
      occupation_id: "text",
      summary: "text",
      language: "text",
      mode: "text",
      submitted_weeks_before: "int",
    },
    needs.map((n) => ({
      id: n.id,
      company_id: n.companyId,
      title: n.title,
      occupation_id: n.occupation ?? null,
      summary: n.summary ?? null,
      language: n.language,
      mode: n.mode,
      submitted_weeks_before: n.submittedWeeksBefore ?? null,
    })),
  );
  counts.need_skills = await insert(
    db,
    "need_skills",
    { need_id: "text", skill_id: "text", kind: "text", position: "int" },
    needs.flatMap((n) => [
      ...n.must.map((skill_id, position) => ({ need_id: n.id, skill_id, kind: "must", position })),
      ...n.nice.map((skill_id, position) => ({ need_id: n.id, skill_id, kind: "nice", position })),
    ]),
  );
  counts.talent = await insert(
    db,
    "talent",
    {
      id: "text",
      reveal_name: "text",
      headline: "text",
      previous_field: "text",
      availability: "text",
      mode: "text",
    },
    talent.map((t) => ({
      id: t.id,
      reveal_name: t.revealName,
      headline: t.headline ?? null,
      previous_field: t.previousField ?? null,
      availability: t.availability ?? null,
      mode: t.mode,
    })),
  );
  counts.talent_skills = await insert(
    db,
    "talent_skills",
    { talent_id: "text", skill_id: "text", level: "text", position: "int" },
    talent.flatMap((t) =>
      t.skills.map((s, position) => ({ talent_id: t.id, skill_id: s.id, level: s.level, position })),
    ),
  );
  counts.talent_evidence = await insert(
    db,
    "talent_evidence",
    { talent_id: "text", position: "int", kind: "text", prompt: "text", excerpt: "text", skills: "text[]" },
    talent.flatMap((t) =>
      t.evidence.map((e, position) => ({
        talent_id: t.id,
        position,
        ...pick(e, "kind", "prompt", "excerpt"),
        skills: e.skills,
      })),
    ),
  );
  counts.talent_languages = await insert(
    db,
    "talent_languages",
    { talent_id: "text", lang: "text", level: "text" },
    talent.flatMap((t) => t.languages.map((l) => ({ talent_id: t.id, ...l }))),
  );
  counts.talent_audit = await insert(
    db,
    "talent_audit",
    { talent_id: "text", origin: "text", education: "text", path: "text" },
    talent.map((t) => ({ talent_id: t.id, ...t.audit })),
  );

  // Scraped public data
  if (withScraped && existsSync(join(ROOT, "data/scraped"))) {
    const manifest = existsSync(join(ROOT, "data/scraped/_manifest.json"))
      ? read("data/scraped/_manifest.json")
      : { sources: {} };
    const files = readdirSync(join(ROOT, "data/scraped")).filter(
      (f) => f.endsWith(".json") && f !== "_manifest.json",
    );
    const sources = [];
    const items = [];
    for (const f of files) {
      const j = read(`data/scraped/${f}`);
      const source = j.source ?? f.replace(/\.json$/, "");
      sources.push({
        source,
        ...pick(j, "title", "origin", "kind", "notes", "retrieved", "count", "failed"),
        status: manifest.sources?.[source]?.status ?? null,
        extra: j.extra ?? null,
      });
      const seen = new Set();
      for (const it of j.items ?? []) {
        const item_id = String(it.id ?? it.url ?? "");
        if (!item_id || seen.has(item_id)) continue;
        seen.add(item_id);
        const title =
          typeof it.title === "string" ? it.title : (it.name?.en ?? it.name?.fi ?? it.name?.sv ?? null);
        items.push({
          source,
          item_id,
          url: it.url ?? it.infoUrl?.en ?? it.infoUrl?.fi ?? null,
          title,
          data: it,
        });
      }
    }
    counts.scraped_sources = await insert(
      db,
      "scraped_sources",
      {
        source: "text",
        title: "text",
        origin: "text",
        kind: "text",
        notes: "text",
        status: "text",
        retrieved: "timestamptz",
        count: "int",
        failed: "int",
        extra: "jsonb",
      },
      sources,
    );
    counts.scraped_items = await insert(
      db,
      "scraped_items",
      { source: "text", item_id: "text", url: "text", title: "text", data: "jsonb" },
      items,
    );
  }

  await db.query("COMMIT");
} catch (err) {
  await db.query("ROLLBACK").catch(() => {});
  console.error("Migration failed, rolled back:", err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}

if (!process.exitCode) {
  console.log(`Migrated to ${new URL(url).hostname}:`);
  console.table(counts);
}

function pick(obj, ...keys) {
  return Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? null]));
}
