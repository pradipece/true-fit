import companiesJson from "@/data/seed/companies.json";
import talentJson from "@/data/seed/talent.json";
import { OCCUPATION_BY_ID, SKILL_BY_ID } from "./esco";
import type { AuditAttributes, Company, Need, Talent } from "./types";

/**
 * Seed loader: reads the synthetic personas from data/seed/*.json, checks them
 * against the cached ESCO subset and the domain enums, and returns typed data.
 * Invalid seeds fail loudly at load time (in dev, build and the browser alike)
 * with every problem listed, instead of producing silent mismatches.
 */

const LANGUAGE_REQ = ["English OK", "Finnish required", "Finnish or English"] as const;
const NEED_MODES = ["On-site", "Hybrid", "Remote"] as const;
const TALENT_MODES = [...NEED_MODES, "Any"] as const;
const LANG_LEVELS = ["Native", "Fluent", "Working", "Learning"] as const;
const SKILL_LEVELS = ["evidenced", "claimed"] as const;
const EVIDENCE_KINDS = ["scenario", "voice", "sample"] as const;
const AUDIT: { [K in keyof AuditAttributes]: readonly AuditAttributes[K][] } = {
  origin: ["Finland", "EU/EEA", "Outside EU"],
  education: ["University", "Vocational", "Self-taught / bootcamp"],
  path: ["Linear", "Career changer"],
};

export class SeedError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(
      `Invalid seed data (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n- ${problems.join("\n- ")}`,
    );
    this.name = "SeedError";
    this.problems = problems;
  }
}

export type Seed = { companies: Company[]; needs: Need[]; talent: Talent[] };

export function loadSeed(raw = { companies: companiesJson.companies, talent: talentJson.talent }): Seed {
  const problems: string[] = [];
  const ids = new Set<string>();

  const unique = (id: string, where: string) => {
    if (ids.has(id)) problems.push(`${where}: duplicate id "${id}"`);
    ids.add(id);
  };
  const skill = (id: string, where: string) => {
    if (!SKILL_BY_ID[id]) problems.push(`${where}: unknown skill "${id}" (not in data/esco/skills.json)`);
  };
  const oneOf = (value: unknown, allowed: readonly string[], where: string) => {
    if (!allowed.includes(value as string))
      problems.push(`${where}: "${value}" is not one of ${allowed.join(" | ")}`);
  };

  const companies: Company[] = [];
  const needs: Need[] = [];

  for (const c of raw.companies) {
    unique(c.id, `company ${c.id}`);
    companies.push({ id: c.id, name: c.name, blurb: c.blurb, sector: c.sector, location: c.location });

    for (const n of c.needs) {
      const at = `need ${n.id} (${c.name})`;
      unique(n.id, at);
      if (!n.must.length) problems.push(`${at}: needs at least one must-have skill`);
      [...n.must, ...n.nice].forEach((s) => skill(s, at));
      n.nice
        .filter((s) => n.must.includes(s))
        .forEach((s) => problems.push(`${at}: "${s}" is both must and nice`));
      if (n.occupation && !OCCUPATION_BY_ID[n.occupation])
        problems.push(`${at}: unknown occupation "${n.occupation}"`);
      oneOf(n.language, LANGUAGE_REQ, `${at} language`);
      oneOf(n.mode, NEED_MODES, `${at} mode`);

      needs.push({
        ...n,
        companyId: c.id,
        company: c.name,
        companyBlurb: c.blurb,
        language: n.language,
        mode: n.mode,
      });
    }
  }

  const talent: Talent[] = raw.talent.map((t) => {
    const at = `talent ${t.id}`;
    unique(t.id, at);
    const own = new Set(t.skills.map((s) => s.id));
    if (own.size !== t.skills.length) problems.push(`${at}: repeated skill`);
    t.skills.forEach((s) => {
      skill(s.id, at);
      oneOf(s.level, SKILL_LEVELS, `${at} skill ${s.id}`);
    });
    t.evidence.forEach((e, i) => {
      oneOf(e.kind, EVIDENCE_KINDS, `${at} evidence #${i + 1}`);
      e.skills.forEach((s) => {
        if (!own.has(s))
          problems.push(`${at} evidence #${i + 1}: cites "${s}", which the profile doesn't list`);
      });
    });
    t.languages.forEach((l) => oneOf(l.level, LANG_LEVELS, `${at} language ${l.lang}`));
    oneOf(t.mode, TALENT_MODES, `${at} mode`);
    const c = (t as { contact?: Partial<Record<string, unknown>> }).contact;
    if (!c) problems.push(`${at}: missing contact`);
    else {
      for (const k of ["fullName", "email", "phone", "city"])
        if (typeof c[k] !== "string" || !(c[k] as string).trim())
          problems.push(`${at} contact.${k}: missing`);
      if (typeof c.email === "string" && !/^[a-z0-9.-]+@example\.com$/.test(c.email))
        problems.push(`${at} contact.email: must be a mock @example.com address`);
    }
    (Object.keys(AUDIT) as (keyof AuditAttributes)[]).forEach((k) =>
      oneOf(t.audit[k], AUDIT[k], `${at} audit.${k}`),
    );

    return { alias: `Candidate ${t.id}`, ...t } as Talent;
  });

  if (problems.length) throw new SeedError(problems);
  return { companies, needs, talent };
}

export const SEED = loadSeed();
export const COMPANIES = SEED.companies;
export const SEED_NEEDS = SEED.needs;
export const SEED_TALENT = SEED.talent;
