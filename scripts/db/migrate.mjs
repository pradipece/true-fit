#!/usr/bin/env node
/**
 * Apply db/schema.sql to Postgres (Tiger Data when TIGER_DATABASE_URL is set, else Supabase;
 * connection: lib/db-config.mjs), and optionally load a JSON snapshot into it.
 *
 * The database is the source of truth: the app keeps no local copy of the data. Without
 * --from, this only creates or upgrades the tables and never touches their contents.
 *
 *   yarn db:migrate                        # schema only (safe to run any time)
 *   yarn db:dump                           # snapshot the database to db/snapshot/ (gitignored)
 *   yarn db:migrate --from db/snapshot     # replace the ESCO + seed tables with a snapshot
 *   yarn db:migrate --from <dir> --talent-only  # replace just the candidate tables
 *   yarn db:migrate --scraped              # (re)load data/scraped (yarn scrape output) only
 *   yarn db:sql --from <dir>               # don't connect: write the migration to db/migrate.sql
 *   yarn db:sql --from <dir> --split 64    #   …as db/migrate-01.sql, -02, … each ≤ 64 KB
 *   yarn db:csv --from <dir>               # don't connect: one CSV per table in db/csv/
 *
 * A snapshot directory holds esco/skills.json, esco/occupations.json, seed/companies.json
 * and seed/talent.json (the shape `yarn db:dump` writes). Loading runs in one transaction,
 * so a failed run leaves the database unchanged.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import pg from "pg";
import { dbConfig, missingDbEnv } from "../../lib/db-config.mjs";

const ROOT = new URL("../../", import.meta.url).pathname;
const args = process.argv.slice(2);
const fromIdx = args.indexOf("--from");
const fromArg = args[fromIdx + 1];
if (fromIdx !== -1 && (!fromArg || fromArg.startsWith("--"))) {
  console.error("--from takes a snapshot directory, e.g. --from db/snapshot");
  process.exit(1);
}
const FROM = fromIdx === -1 ? null : resolve(ROOT, fromArg);
const read = (p) => JSON.parse(readFileSync(join(FROM, p), "utf8"));
// --talent-only: replace just the candidate tables (seed/talent.json), leave the rest.
const talentOnly = args.includes("--talent-only");
// --scraped: load data/scraped (the `yarn scrape` output) into scraped_sources/scraped_items.
const SCRAPED = join(ROOT, "data/scraped");
const withScraped = args.includes("--scraped");
if (withScraped && !existsSync(SCRAPED)) {
  console.error("--scraped: data/scraped doesn't exist; run `yarn scrape` first.");
  process.exit(1);
}
const withSeed = !!FROM;
const sqlIdx = args.indexOf("--sql");
const sqlArg = args[sqlIdx + 1];
const sqlOut =
  sqlIdx === -1 ? null : resolve(ROOT, sqlArg && !sqlArg.startsWith("--") ? sqlArg : "db/migrate.sql");

// --csv [dir]: write one CSV per table (header row, Postgres array/JSON literals) plus an
// import.sql that \\copy-loads them in foreign-key order. Default dir: db/csv.
const csvIdx = args.indexOf("--csv");
const csvArg = args[csvIdx + 1];
const csvOut = csvIdx === -1 ? null : resolve(ROOT, csvArg && !csvArg.startsWith("--") ? csvArg : "db/csv");

// --split <KB>: write numbered parts (db/migrate-01.sql, -02, …) each under that size,
// for SQL editors that cap the query size. Run the parts in order.
const splitIdx = args.indexOf("--split");
const splitBytes = splitIdx === -1 ? 0 : Number(args[splitIdx + 1] || 256) * 1024;
if (splitIdx !== -1 && !(splitBytes > 0)) {
  console.error("--split takes a size in KB, e.g. --split 256");
  process.exit(1);
}

const offline = sqlOut || csvOut;
if (offline && !FROM) {
  console.error("--sql and --csv write a snapshot's data: pass --from <dir> (see `yarn db:dump`).");
  process.exit(1);
}
if (talentOnly && !FROM) {
  console.error("--talent-only needs --from <dir>.");
  process.exit(1);
}
const target = offline ? null : dbConfig();
const config = target?.config;
if (!offline && !config) {
  console.error(
    `No database is configured: set TIGER_DATABASE_URL, or ${missingDbEnv().join(", ")} for Supabase (see .env.example), or use --sql.`,
  );
  process.exit(1);
}

/** Bulk insert: rows go in as JSON array parameters and are expanded server-side. */
async function insert(db, table, columns, rows, { upsertOn } = {}) {
  if (!rows.length) return 0;
  const cols = Object.keys(columns);
  if (db.csv) return db.csv(table, columns, rows);
  const defs = cols.map((c) => `${c} ${columns[c]}`).join(", ");
  // upsertOn: primary-key column; existing rows are updated instead of failing.
  const conflict = upsertOn
    ? ` ON CONFLICT (${upsertOn}) DO UPDATE SET ${cols
        .filter((c) => c !== upsertOn)
        .map((c) => `${c} = EXCLUDED.${c}`)
        .join(", ")}`
    : "";
  const text = `INSERT INTO ${table} (${cols.join(", ")}) SELECT ${cols.join(", ")} FROM jsonb_to_recordset($1::jsonb) AS r(${defs})${conflict}`;
  // jsonb rejects \u0000, which a few scraped pages contain.
  const json = (batch) => JSON.stringify(batch).replaceAll("\\u0000", "");
  // Batches of ≤500 rows, and small enough to fit a split part (quotes may double in SQL).
  const maxBytes = splitBytes ? (splitBytes - text.length - 200) / 1.1 : Infinity;
  let batch = [];
  let size = 2;
  for (const row of rows) {
    const rowSize = Buffer.byteLength(json(row)) + 1;
    if (batch.length && (batch.length >= 500 || size + rowSize > maxBytes)) {
      await db.query(text, [json(batch)]);
      batch = [];
      size = 2;
    }
    batch.push(row);
    size += rowSize;
  }
  await db.query(text, [json(batch)]);
  return rows.length;
}

/** Stand-in for pg.Client that writes each statement, with $1 inlined, to .sql file(s). */
function sqlFile(path) {
  const header = (part) =>
    [
      `-- Generated by \`yarn db:sql\` from ${relative(ROOT, FROM)}/ (scripts/db/migrate.mjs). Do not edit by hand.`,
      `-- ${new Date().toISOString()} · ${
        talentOnly
          ? "synthetic candidates (talent tables) plus the ESCO skills they reference (upserted)"
          : withScraped
            ? "includes data/scraped (real third-party pages)"
            : "synthetic seeds + ESCO only"
      }`,
      ...(part
        ? [`-- Part ${part}: run the parts in order. Part 1 creates the tables and empties them.`]
        : []),
      "",
    ].join("\n");
  const literal = (s) => `'${s.replaceAll("'", "''")}'`;
  const parts = [[]];
  let size = 0;
  const written = [];
  return {
    written,
    query: async (text, params = []) => {
      // Split parts each get their own transaction instead of one around everything.
      if (splitBytes && /^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return;
      const stmt = `${text
        .replace(/\$(\d+)/g, (_, n) => literal(params[n - 1]))
        .trimEnd()
        .replace(/;$/, "")};\n`;
      const bytes = Buffer.byteLength(stmt);
      if (splitBytes && parts.at(-1).length && size + bytes > splitBytes - 400) {
        parts.push([]);
        size = 0;
      }
      if (splitBytes && bytes > splitBytes - 400)
        console.warn(
          `warning: one ${Math.round(bytes / 1024)} KB statement exceeds --split; it gets its own part`,
        );
      parts.at(-1).push(stmt);
      size += bytes;
    },
    end: async () => {
      if (!splitBytes) {
        writeFileSync(path, header() + parts[0].join("\n"));
        written.push(path);
        return;
      }
      parts.forEach((stmts, i) => {
        const file = path.replace(/\.sql$/, "") + `-${String(i + 1).padStart(2, "0")}.sql`;
        writeFileSync(
          file,
          `${header(`${i + 1} of ${parts.length}`)}BEGIN;\n\n${stmts.join("\n")}\nCOMMIT;\n`,
        );
        written.push(file);
      });
    },
  };
}

/** Stand-in for pg.Client that writes each table to <dir>/NN_<table>.csv plus import.sql. */
function csvDir(dir) {
  // Quote every non-null value, so an empty string stays distinct from NULL (empty field).
  const quote = (s) => `"${s.replaceAll('"', '""')}"`;
  const pgArray = (a) =>
    `{${a.map((v) => (v == null ? "NULL" : `"${String(v).replace(/["\\]/g, "\\$&")}"`)).join(",")}}`;
  const field = (v, type) => {
    if (v == null) return "";
    if (type.endsWith("[]")) return quote(pgArray(v));
    if (type === "jsonb") return quote(JSON.stringify(v).replaceAll("\\u0000", ""));
    return quote(String(v));
  };
  const files = [];
  const written = [];
  return {
    written,
    query: async () => {},
    csv: (table, columns, rows) => {
      const cols = Object.keys(columns);
      const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => field(r[c], columns[c])).join(","))];
      const file = files.find((f) => f.table === table) ?? { table, cols, name: "", lines: [] };
      if (!file.name) {
        file.name = `${String(files.length + 1).padStart(2, "0")}_${table}.csv`;
        files.push(file);
        file.lines.push(lines[0]);
      }
      file.lines.push(...lines.slice(1));
      return rows.length;
    },
    end: async () => {
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      for (const f of files) writeFileSync(join(dir, f.name), f.lines.join("\n") + "\n");
      const tables = files.map((f) => f.table).join(", ");
      writeFileSync(
        join(dir, "import.sql"),
        [
          `-- Generated by \`yarn db:csv\` (scripts/db/migrate.mjs). Do not edit by hand.`,
          `-- Load with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ${relative(ROOT, dir)}/import.sql`,
          `-- (run from the repo root). Creates missing tables, replaces their contents, one transaction.`,
          "",
          "BEGIN;",
          `\\i db/schema.sql`,
          `TRUNCATE ${tables} CASCADE;`,
          ...files.map(
            (f) =>
              `\\copy ${f.table} (${f.cols.join(", ")}) FROM '${relative(ROOT, join(dir, f.name))}' WITH (FORMAT csv, HEADER true)`,
          ),
          "COMMIT;",
          "",
        ].join("\n"),
      );
      written.push(...files.map((f) => join(dir, f.name)), join(dir, "import.sql"));
    },
  };
}

const skillsJson = withSeed ? read("esco/skills.json") : null;
const occupationsJson = withSeed ? read("esco/occupations.json") : null;
const { companies } = withSeed ? read("seed/companies.json") : { companies: [] };
const { talent } = withSeed ? read("seed/talent.json") : { talent: [] };

/** The ESCO skills subset; talent_skills and need_skills reference it. */
function insertEscoSkills(opts) {
  return insert(
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
      position: "int",
    },
    skillsJson.skills.map((s, position) => ({
      id: s.id,
      label: s.label,
      skill_group: s.group,
      uri: s.uri ?? null,
      match: s.match ?? null,
      esco_label: s.escoLabel ?? null,
      keywords: s.keywords ?? [],
      labels: s.labels ?? {},
      alt_labels: s.altLabels ?? [],
      position,
    })),
    opts,
  );
}

const db = csvOut ? csvDir(csvOut) : sqlOut ? sqlFile(sqlOut) : new pg.Client(config);
try {
  if (!offline) await db.connect();
} catch (err) {
  console.error(`Could not connect to ${target.provider}: ${err.message}`);
  process.exit(1);
}

const counts = {};
try {
  await db.query("BEGIN");
  await db.query(readFileSync(join(ROOT, "db/schema.sql"), "utf8"));
  if (withScraped) await db.query("TRUNCATE scraped_sources, scraped_items CASCADE");
  if (talentOnly) {
    // CASCADE empties talent_skills, talent_evidence, talent_languages, talent_audit, talent_contact.
    await db.query("TRUNCATE talent CASCADE");
    // Upsert (not replace) the skills, so the file also works on a database without ESCO loaded.
    counts.esco_skills = await insertEscoSkills({ upsertOn: "id" });
  } else if (withSeed) {
    await db.query(`TRUNCATE esco_meta, esco_skills, esco_skill_relations, esco_occupations, esco_occupation_skills,
    companies, needs, need_skills, talent, talent_skills, talent_evidence, talent_languages, talent_audit, talent_contact
    CASCADE`);
  }

  if (withSeed && !talentOnly) {
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
    counts.esco_skills = await insertEscoSkills();
    counts.esco_skill_relations = await insert(
      db,
      "esco_skill_relations",
      { skill_id: "text", related_id: "text", weight: "real", position: "int" },
      skillsJson.related.map(([skill_id, related_id, weight], position) => ({
        skill_id,
        related_id,
        weight,
        position,
      })),
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
        fi_title: "text",
        position: "int",
      },
      occs.map((o, position) => ({
        id: o.id,
        uri: o.uri,
        label: o.label,
        isco: o.isco ?? null,
        labels: o.labels ?? {},
        alt_labels: o.altLabels ?? {},
        extra_titles: o.extraTitles ?? [],
        fi_title: o.fiTitle ?? null,
        position,
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
      { id: "text", name: "text", blurb: "text", sector: "text", location: "text", position: "int" },
      companies.map((c, position) => ({ ...pick(c, "id", "name", "blurb", "sector", "location"), position })),
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
        position: "int",
      },
      needs.map((n, position) => ({
        id: n.id,
        company_id: n.companyId,
        title: n.title,
        occupation_id: n.occupation ?? null,
        summary: n.summary ?? null,
        language: n.language,
        mode: n.mode,
        submitted_weeks_before: n.submittedWeeksBefore ?? null,
        position,
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
  }

  if (withSeed) {
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
        position: "int",
      },
      talent.map((t, position) => ({
        id: t.id,
        reveal_name: t.revealName,
        headline: t.headline ?? null,
        previous_field: t.previousField ?? null,
        availability: t.availability ?? null,
        mode: t.mode,
        position,
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
      { talent_id: "text", lang: "text", level: "text", position: "int" },
      talent.flatMap((t) => t.languages.map((l, position) => ({ talent_id: t.id, ...l, position }))),
    );
    counts.talent_audit = await insert(
      db,
      "talent_audit",
      { talent_id: "text", origin: "text", education: "text", path: "text" },
      talent.map((t) => ({ talent_id: t.id, ...t.audit })),
    );
    counts.talent_contact = await insert(
      db,
      "talent_contact",
      { talent_id: "text", full_name: "text", email: "text", phone: "text", city: "text" },
      talent.map((t) => ({
        talent_id: t.id,
        full_name: t.contact.fullName,
        ...pick(t.contact, "email", "phone", "city"),
      })),
    );
  }

  // Scraped public data
  if (withScraped) {
    const readScraped = (f) => JSON.parse(readFileSync(join(SCRAPED, f), "utf8"));
    const manifest = existsSync(join(SCRAPED, "_manifest.json"))
      ? readScraped("_manifest.json")
      : { sources: {} };
    const files = readdirSync(SCRAPED).filter((f) => f.endsWith(".json") && f !== "_manifest.json");
    const sources = [];
    const items = [];
    for (const f of files) {
      const j = readScraped(f);
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
  console.log(
    offline
      ? `Wrote ${db.written.map((f) => relative(ROOT, f)).join(", ")}:`
      : `Migrated to ${target.provider} (${config.host ?? new URL(config.connectionString).hostname}):`,
  );
  console.table(counts);
}

function pick(obj, ...keys) {
  return Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? null]));
}
