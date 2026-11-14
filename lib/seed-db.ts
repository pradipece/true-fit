import { cacheLife, cacheTag } from "next/cache";
import { db, dbConfigured } from "./db";
import { loadSeed, SEED, type Seed } from "./seed";

/**
 * Server-side seed source: reads companies, needs and talent from Supabase and runs
 * them through the same validation as the JSON seeds (loadSeed). If Supabase isn't
 * configured or can't be reached, falls back to data/seed/*.json so the demo still runs
 * offline. Load the database with `yarn db:migrate`.
 *
 * The ESCO subset stays on data/esco: it's static reference data used synchronously
 * in the browser, and matching must run on exactly that subset.
 */

export type SeedSource = { source: "supabase" | "json"; reason?: string };
export type LoadedSeed = Seed & SeedSource;

type RawSeed = NonNullable<Parameters<typeof loadSeed>[0]>;

export async function getSeed(): Promise<LoadedSeed> {
  "use cache";
  cacheTag("seed");
  if (!dbConfigured()) {
    cacheLife("hours");
    return { ...SEED, source: "json", reason: "Supabase database is not configured" };
  }
  try {
    const seed = loadSeed(await readRaw());
    cacheLife("hours");
    return { ...seed, source: "supabase" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[supabase] using JSON seeds: ${reason}`);
    // Retry soon rather than serving the fallback for hours.
    cacheLife("minutes");
    return { ...SEED, source: "json", reason };
  }
}

/** Rebuild the seed files' shape from the tables, in the files' order. */
async function readRaw(): Promise<RawSeed> {
  const q = db();
  const [companies, needs, needSkills, talent, skills, evidence, languages, audit, contact] =
    await Promise.all([
      q.query(`SELECT id, name, blurb, sector, location FROM companies ORDER BY position NULLS LAST, id`),
      q.query(
        `SELECT id, company_id, title, occupation_id, summary, language, mode, submitted_weeks_before
         FROM needs ORDER BY position NULLS LAST, id`,
      ),
      q.query(`SELECT need_id, skill_id, kind FROM need_skills ORDER BY need_id, kind, position`),
      q.query(
        `SELECT id, reveal_name, headline, previous_field, availability, mode
         FROM talent ORDER BY position NULLS LAST, id`,
      ),
      q.query(`SELECT talent_id, skill_id, level FROM talent_skills ORDER BY talent_id, position`),
      q.query(
        `SELECT talent_id, kind, prompt, excerpt, skills FROM talent_evidence ORDER BY talent_id, position`,
      ),
      q.query(
        `SELECT talent_id, lang, level FROM talent_languages ORDER BY talent_id, position NULLS LAST, lang`,
      ),
      q.query(`SELECT talent_id, origin, education, path FROM talent_audit`),
      q.query(`SELECT talent_id, full_name, email, phone, city FROM talent_contact`),
    ]);
  if (!companies.rows.length || !talent.rows.length)
    throw new Error("Supabase tables are empty; run `yarn db:migrate`");

  const group = <T extends Record<string, unknown>>(rows: T[], key: keyof T) => {
    const m = new Map<unknown, T[]>();
    for (const r of rows) m.set(r[key], [...(m.get(r[key]) ?? []), r]);
    return (id: unknown) => m.get(id) ?? [];
  };
  const opt = <T>(v: T | null) => v ?? undefined;
  const needsOf = group(needs.rows, "company_id");
  const skillsOfNeed = group(needSkills.rows, "need_id");
  const skillsOf = group(skills.rows, "talent_id");
  const evidenceOf = group(evidence.rows, "talent_id");
  const languagesOf = group(languages.rows, "talent_id");
  const auditOf = new Map(audit.rows.map((a) => [a.talent_id, a]));
  const contactOf = new Map(contact.rows.map((c) => [c.talent_id, c]));

  return {
    companies: companies.rows.map((c) => ({
      id: c.id,
      name: c.name,
      blurb: opt(c.blurb),
      sector: opt(c.sector),
      location: opt(c.location),
      needs: needsOf(c.id).map((n) => ({
        id: n.id,
        title: n.title,
        occupation: opt(n.occupation_id),
        summary: opt(n.summary),
        must: skillsOfNeed(n.id)
          .filter((s) => s.kind === "must")
          .map((s) => s.skill_id),
        nice: skillsOfNeed(n.id)
          .filter((s) => s.kind === "nice")
          .map((s) => s.skill_id),
        language: n.language,
        mode: n.mode,
        submittedWeeksBefore: opt(n.submitted_weeks_before),
      })),
    })),
    talent: talent.rows.map((t) => {
      const a = auditOf.get(t.id);
      if (!a) throw new Error(`talent ${t.id} has no talent_audit row`);
      const c = contactOf.get(t.id);
      return {
        id: t.id,
        revealName: t.reveal_name,
        contact: c ? { fullName: c.full_name, email: c.email, phone: c.phone, city: c.city } : undefined,
        headline: opt(t.headline),
        previousField: opt(t.previous_field),
        skills: skillsOf(t.id).map((s) => ({ id: s.skill_id, level: s.level })),
        evidence: evidenceOf(t.id).map((e) => ({
          kind: e.kind,
          prompt: opt(e.prompt),
          excerpt: opt(e.excerpt),
          skills: e.skills,
        })),
        languages: languagesOf(t.id).map((l) => ({ lang: l.lang, level: l.level })),
        availability: opt(t.availability),
        mode: t.mode,
        audit: { origin: a.origin, education: a.education, path: a.path },
      };
    }),
  } as RawSeed;
}
