/**
 * Read the ESCO subset and the synthetic seeds back out of Postgres, in the snapshot shape
 * (esco/skills.json, esco/occupations.json, seed/companies.json, seed/talent.json).
 * Shared by the app (lib/esco-db.ts, lib/seed-db.ts) and `yarn db:dump`, so what the app
 * reads is exactly what a dump writes. Rows come back in their authored order (`position`).
 *
 * Local and runtime only: it never runs in the build pipeline (`next build` on Vercel/CI).
 * The app defers every read to request time (connection() in lib/seed-db.ts), and
 * notDuringBuild() below refuses outright if anything tries during a build, so the build
 * needs no database credentials and never connects.
 *
 * @typedef {{ query: (text: string) => Promise<{ rows: any[] }> }} Queryable
 */

function notDuringBuild() {
  if (process.env.NEXT_PHASE === "phase-production-build")
    throw new Error(
      "lib/db-read.mjs: the database is not read during the build. Read it at request time (await connection(), see lib/seed-db.ts).",
    );
}

/** Drop null fields, so optional values read back as absent (like the JSON they came from). */
const clean = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));

const group = (rows, key) => {
  const m = new Map();
  for (const r of rows) m.set(r[key], [...(m.get(r[key]) ?? []), r]);
  return (id) => m.get(id) ?? [];
};

/**
 * @param {Queryable} q
 * @returns {Promise<{ skills: object, occupations: object }>}
 */
export async function readEsco(q) {
  notDuringBuild();
  const [meta, skills, related, occupations, occSkills] = await Promise.all([
    q.query(`SELECT dataset, source, licence, retrieved FROM esco_meta`),
    q.query(
      `SELECT id, label, skill_group, uri, match, esco_label, keywords, labels, alt_labels
       FROM esco_skills ORDER BY position NULLS LAST, id`,
    ),
    q.query(
      `SELECT skill_id, related_id, weight FROM esco_skill_relations
       ORDER BY position NULLS LAST, skill_id, related_id`,
    ),
    q.query(
      `SELECT id, uri, label, isco, labels, alt_labels, extra_titles, fi_title
       FROM esco_occupations ORDER BY position NULLS LAST, id`,
    ),
    q.query(`SELECT occupation_id, skill_id FROM esco_occupation_skills ORDER BY occupation_id, position`),
  ]);
  if (!skills.rows.length)
    throw new Error("The ESCO tables are empty; load a snapshot with `yarn db:migrate --from <dir>`");

  const metaOf = (dataset) => meta.rows.find((m) => m.dataset === dataset) ?? {};
  const skillsOf = group(occSkills.rows, "occupation_id");
  const { source: sSource, licence: sLicence, retrieved: sRetrieved } = metaOf("skills");
  const { source: oSource, licence: oLicence, retrieved: oRetrieved } = metaOf("occupations");

  return {
    skills: clean({
      source: sSource,
      licence: sLicence,
      retrieved: sRetrieved,
      skills: skills.rows.map((s) =>
        clean({
          id: s.id,
          label: s.label,
          group: s.skill_group,
          uri: s.uri,
          match: s.match,
          keywords: s.keywords,
          escoLabel: s.esco_label,
          labels: s.labels,
          altLabels: s.alt_labels,
        }),
      ),
      // real → float4; round back to the 2-decimal weights the taxonomy uses.
      related: related.rows.map((r) => [r.skill_id, r.related_id, Math.round(r.weight * 100) / 100]),
    }),
    occupations: clean({
      source: oSource,
      licence: oLicence,
      retrieved: oRetrieved,
      occupations: occupations.rows.map((o) =>
        clean({
          id: o.id,
          uri: o.uri,
          skills: skillsOf(o.id).map((s) => s.skill_id),
          extraTitles: o.extra_titles,
          label: o.label,
          isco: o.isco ?? null,
          labels: o.labels,
          altLabels: o.alt_labels,
          fiTitle: o.fi_title,
        }),
      ),
    }),
  };
}

/**
 * @param {Queryable} q
 * @returns {Promise<{ companies: object[], talent: object[] }>}
 */
export async function readSeed(q) {
  notDuringBuild();
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
    throw new Error("The seed tables are empty; load a snapshot with `yarn db:migrate --from <dir>`");

  const needsOf = group(needs.rows, "company_id");
  const skillsOfNeed = group(needSkills.rows, "need_id");
  const skillsOf = group(skills.rows, "talent_id");
  const evidenceOf = group(evidence.rows, "talent_id");
  const languagesOf = group(languages.rows, "talent_id");
  const auditOf = new Map(audit.rows.map((a) => [a.talent_id, a]));
  const contactOf = new Map(contact.rows.map((c) => [c.talent_id, c]));

  return {
    companies: companies.rows.map((c) =>
      clean({
        id: c.id,
        name: c.name,
        blurb: c.blurb,
        sector: c.sector,
        location: c.location,
        needs: needsOf(c.id).map((n) =>
          clean({
            id: n.id,
            title: n.title,
            occupation: n.occupation_id,
            summary: n.summary,
            must: skillsOfNeed(n.id)
              .filter((s) => s.kind === "must")
              .map((s) => s.skill_id),
            nice: skillsOfNeed(n.id)
              .filter((s) => s.kind === "nice")
              .map((s) => s.skill_id),
            language: n.language,
            mode: n.mode,
            submittedWeeksBefore: n.submitted_weeks_before,
          }),
        ),
      }),
    ),
    talent: talent.rows.map((t) => {
      const a = auditOf.get(t.id);
      if (!a) throw new Error(`talent ${t.id} has no talent_audit row`);
      const c = contactOf.get(t.id);
      return clean({
        id: t.id,
        revealName: t.reveal_name,
        contact: c ? { fullName: c.full_name, email: c.email, phone: c.phone, city: c.city } : null,
        headline: t.headline,
        previousField: t.previous_field,
        skills: skillsOf(t.id).map((s) => ({ id: s.skill_id, level: s.level })),
        evidence: evidenceOf(t.id).map((e) =>
          clean({ kind: e.kind, prompt: e.prompt, excerpt: e.excerpt, skills: e.skills }),
        ),
        languages: languagesOf(t.id).map((l) => ({ lang: l.lang, level: l.level })),
        availability: t.availability,
        mode: t.mode,
        audit: { origin: a.origin, education: a.education, path: a.path },
      });
    }),
  };
}
