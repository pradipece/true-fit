import occupationsJson from "@/data/esco/occupations.json";
import skillsJson from "@/data/esco/skills.json";
import type { Occupation, Skill } from "./types";

/**
 * Cached ESCO subset (skills + occupations) for the prototype, with lookup helpers.
 * Data lives in data/esco/*.json; `node scripts/refresh-esco.mjs` re-syncs the ESCO
 * labels from the public API. A real deployment would sync the full taxonomy.
 */

export const SKILLS = skillsJson.skills as Skill[];
export const OCCUPATIONS = occupationsJson.occupations as Occupation[];
export const ESCO_RETRIEVED = skillsJson.retrieved;

export const SKILL_BY_ID: Record<string, Skill> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
export const OCCUPATION_BY_ID: Record<string, Occupation> = Object.fromEntries(
  OCCUPATIONS.map((o) => [o.id, o]),
);

export const getSkill = (id: string): Skill | undefined => SKILL_BY_ID[id];
export const skillLabel = (id: string) => SKILL_BY_ID[id]?.label ?? id;

// ── Text matching ────────────────────────────────────────────────────────────

/** Lowercase, strip diacritics and collapse whitespace so "Päällikkö" ≈ "paallikko". */
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 0 = no match. Higher is better. Both inputs must already be normalized. */
function scoreText(q: string, candidate: string): number {
  if (!q || !candidate) return 0;
  if (candidate === q) return 100;
  if (candidate.startsWith(q)) return 80;
  if (candidate.includes(` ${q}`)) return 60;
  if (candidate.includes(q)) return 40;
  // Query contains the whole candidate ("senior chef de projet" ⊃ "chef de projet"); longer wins.
  if (candidate.length >= 4 && q.includes(candidate)) return 30 + Math.min(candidate.length, 30);
  return 0;
}

function bestScore(q: string, candidates: string[]) {
  let best = { score: 0, matched: "" };
  for (const c of candidates) {
    const score = scoreText(q, normalize(c));
    if (score > best.score) best = { score, matched: c };
  }
  return best;
}

export type SearchHit<T> = { item: T; score: number; matched: string };

function rank<T>(items: T[], q: string, fields: (item: T) => string[], limit: number): SearchHit<T>[] {
  const nq = normalize(q);
  if (nq.length < 2) return [];
  return items
    .map((item) => ({ item, ...bestScore(nq, fields(item)) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── Skills ───────────────────────────────────────────────────────────────────

const skillTerms = (s: Skill) => [
  s.label,
  s.escoLabel,
  ...Object.values(s.labels).filter((v): v is string => !!v),
  ...s.altLabels,
];

/**
 * Search skills by label, ESCO label, Finnish/Swedish label or synonym.
 * Pass `keywords: true` to also match the intake keyword hints.
 */
export function searchSkills(
  query: string,
  { limit = 8, group, keywords = false }: { limit?: number; group?: Skill["group"]; keywords?: boolean } = {},
): SearchHit<Skill>[] {
  const pool = group ? SKILLS.filter((s) => s.group === group) : SKILLS;
  return rank(pool, query, (s) => (keywords ? [...skillTerms(s), ...s.keywords] : skillTerms(s)), limit);
}

/** Best single skill for a free-text label, or undefined. */
export const findSkill = (query: string) => searchSkills(query, { limit: 1, keywords: true })[0]?.item;

/**
 * Adjacency between skills, used to surface *transferable* experience.
 * Values are credit fractions (0..1), symmetric.
 */
const ADJACENT = skillsJson.related as [string, string, number][];
const ADJ = new Map<string, Map<string, number>>();
for (const [a, b, w] of ADJACENT) {
  if (!ADJ.has(a)) ADJ.set(a, new Map());
  if (!ADJ.has(b)) ADJ.set(b, new Map());
  ADJ.get(a)!.set(b, w);
  ADJ.get(b)!.set(a, w);
}

export function adjacency(a: string, b: string): number {
  return ADJ.get(a)?.get(b) ?? 0;
}

/** Related skills, strongest first. */
export function relatedSkills(id: string, minWeight = 0): { skill: Skill; weight: number }[] {
  return [...(ADJ.get(id) ?? [])]
    .filter(([, w]) => w >= minWeight)
    .sort((a, b) => b[1] - a[1])
    .map(([other, weight]) => ({ skill: SKILL_BY_ID[other], weight }))
    .filter((r) => r.skill);
}

/** Propose skill ids from free text (intake assistant). Multilingual substring hints. */
export function extractSkills(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  return SKILLS.filter((s) => s.keywords.some((w) => t.includes(w))).map((s) => s.id);
}

// ── Occupations ──────────────────────────────────────────────────────────────

const occupationTerms = (o: Occupation) => [
  ...Object.values(o.labels).flatMap((v) => (v ? v.split("/") : [])),
  ...o.altLabels.en,
  ...o.altLabels.fi,
  ...o.extraTitles,
  ...(o.fiTitle ? [o.fiTitle] : []),
];

/** Search occupations by title in any cached language, synonyms, or informal titles. */
export function searchOccupations(query: string, limit = 5): SearchHit<Occupation>[] {
  return rank(OCCUPATIONS, query, occupationTerms, limit);
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Finnish title · English title" for an occupation. */
export function localTitle(o: Occupation) {
  return `${capitalise(o.fiTitle ?? o.labels.fi ?? o.label)} · ${capitalise(o.label)}`;
}

export type TitleTranslation = {
  localTitle: string;
  skills: string[];
  occupation?: Occupation;
  /** The title variant that matched the input. */
  matched?: string;
};

/** Skills translator: foreign or unusual job titles → ESCO occupation + skills + local vocabulary. */
export function translateTitle(input: string): TitleTranslation | null {
  if (input.trim().length < 3) return null;
  const hit = searchOccupations(input, 1)[0];
  if (hit && hit.score >= 30) {
    return {
      localTitle: localTitle(hit.item),
      skills: hit.item.skills,
      occupation: hit.item,
      matched: hit.matched,
    };
  }
  const skills = extractSkills(input);
  return skills.length
    ? { localTitle: "No direct title match — skills inferred from your words", skills }
    : null;
}
