import { cacheLife } from "next/cache";
import { extractSkills, normalize, SKILLS } from "./esco";

/**
 * Live ESCO Web Service API client (https://ec.europa.eu/esco/api), server-only.
 * Only the search text the user typed (a job title or skill word) and public taxonomy
 * URIs are sent: never names or profile data. Responses are cached for a day, so
 * repeated lookups during the event are served from cache, not the EU's API.
 *
 * Matching still runs on the ESCO subset in the database (lib/esco.ts): live ESCO concepts are
 * mapped to it by exact URI, or by keyword as a "close" link.
 */

const API = "https://ec.europa.eu/esco/api";
const TIMEOUT_MS = 8000;
/** ESCO search only matches labels in the requested language, so we query the likely ones in parallel. */
export const SEARCH_LANGUAGES = ["en", "fi", "sv", "de", "fr", "es", "pt", "pl", "et", "uk"] as const;

export type EscoConceptHit = { uri: string; title: string; matched: string; language: string };

export type SubsetLink = { id: string; via: "uri" | "keyword" };

export type EscoSkillRef = { uri: string; title: string; subset?: SubsetLink };

export type EscoOccupation = {
  uri: string;
  labels: { en: string; fi?: string; sv?: string };
  description: string;
  essential: EscoSkillRef[];
  optional: EscoSkillRef[];
  regulated: boolean;
  url: string;
};

const byUri = (uri: string) => SKILLS.find((s) => s.uri === uri)?.id;

/** Link an ESCO skill to the event's skill set: exact concept, else a keyword hint on its label. */
export function toSubset(uri: string, title: string): SubsetLink | undefined {
  const exact = byUri(uri);
  if (exact) return { id: exact, via: "uri" };
  const kw = extractSkills(title)[0];
  return kw ? { id: kw, via: "keyword" } : undefined;
}

/** 0..1: how much of the query appears in the label (accents and case ignored). */
export function relevance(query: string, label: string) {
  const q = normalize(query);
  const l = normalize(label);
  if (!q || !l) return 0;
  if (l === q || l.split("/").some((part) => part.trim() === q)) return 1;
  if (l.startsWith(q) || l.includes(q)) return 0.9;
  const words = q.split(/[\s,/()-]+/).filter((w) => w.length >= 3);
  if (!words.length) return 0;
  return words.filter((w) => l.includes(w)).length / words.length;
}

/** Public ESCO portal page for a concept, for "view on ESCO" links. */
export const escoPortalUrl = (uri: string) =>
  `https://esco.ec.europa.eu/en/classification/${uri.includes("/occupation/") ? "occupation" : "skill"}_main#uri=${uri}`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`ESCO ${res.status} for ${path}`);
  return (await res.json()) as T;
}

type SearchResponse = {
  _embedded?: { results?: { uri: string; title: string; preferredLabel?: Record<string, string> }[] };
};

async function searchOne(text: string, type: "skill" | "occupation", language: string, limit: number) {
  "use cache";
  cacheLife("days");
  const q = new URLSearchParams({ text, type, language, limit: String(limit), full: "false" });
  const r = await getJson<SearchResponse>(`/search?${q}`);
  return (r._embedded?.results ?? []).map((x) => ({ uri: x.uri, matched: x.title, language }));
}

/** English label for a concept URI (search results come back in the search language). */
async function englishTitle(uri: string, type: "skill" | "occupation") {
  "use cache";
  cacheLife("days");
  const r = await getJson<{ preferredLabel?: Record<string, string>; title?: string }>(
    `/resource/${type}?${new URLSearchParams({ uri, language: "en" })}`,
  );
  return r.preferredLabel?.en ?? r.title ?? uri;
}

/**
 * Search ESCO in several languages at once and merge by concept. A concept found in
 * more languages, or ranked higher, comes first. Unreachable languages are skipped.
 */
export async function searchEsco(
  text: string,
  type: "skill" | "occupation",
  { limit = 5, languages = SEARCH_LANGUAGES as readonly string[] } = {},
): Promise<EscoConceptHit[]> {
  const q = text.trim().slice(0, 80);
  if (q.length < 2) return [];
  const settled = await Promise.allSettled(languages.map((l) => searchOne(q, type, l, 3)));
  const score = new Map<string, { hit: Omit<EscoConceptHit, "title">; score: number }>();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    r.value.forEach((hit, rank) => {
      // ESCO's search is fuzzy and always returns something in every language; keep only
      // labels that actually resemble what was typed.
      const rel = relevance(q, hit.matched);
      if (rel < 0.66) return;
      const prev = score.get(hit.uri);
      const s = (prev?.score ?? 0) + rel * 10 + (3 - rank);
      // Keep the label that best matches what was typed (shown as "matched").
      const best = prev && relevance(q, prev.hit.matched) >= rel ? prev.hit : hit;
      score.set(hit.uri, { hit: best, score: s });
    });
  }
  if (!score.size && settled.every((r) => r.status === "rejected")) throw new Error("ESCO API unreachable");
  const top = [...score.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  return Promise.all(
    top.map(async ({ hit }) => ({
      ...hit,
      title: hit.language === "en" ? hit.matched : await englishTitle(hit.uri, type).catch(() => hit.matched),
    })),
  );
}

type OccupationResponse = {
  uri: string;
  preferredLabel?: Record<string, string>;
  description?: Record<string, { literal?: string }>;
  _links?: {
    hasEssentialSkill?: { uri: string; title: string }[];
    hasOptionalSkill?: { uri: string; title: string }[];
    regulatedProfessionNote?: unknown;
  };
};

/** Full ESCO occupation with essential and optional skills, each linked to the event's skill set. */
export async function getOccupation(uri: string): Promise<EscoOccupation> {
  "use cache";
  cacheLife("days");
  const r = await getJson<OccupationResponse>(
    `/resource/occupation?${new URLSearchParams({ uri, language: "en" })}`,
  );
  const refs = (xs: { uri: string; title: string }[] = []) =>
    xs.map((x) => ({ uri: x.uri, title: x.title, subset: toSubset(x.uri, x.title) }));
  return {
    uri: r.uri,
    labels: { en: r.preferredLabel?.en ?? uri, fi: r.preferredLabel?.fi, sv: r.preferredLabel?.sv },
    description: r.description?.en?.literal ?? "",
    essential: refs(r._links?.hasEssentialSkill),
    optional: refs(r._links?.hasOptionalSkill),
    regulated: !!r._links?.regulatedProfessionNote,
    url: escoPortalUrl(r.uri),
  };
}
