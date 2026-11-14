import { adjacency } from "./esco";
import type { MatchExplanation, Need, Talent } from "./types";

export const SUGGEST_THRESHOLD = 0.4;

const MUST_WEIGHT = 3;
const NICE_WEIGHT = 1;
const EVIDENCED = 1;
const CLAIMED = 0.5;
const TRANSFER_FACTOR = 0.8;

/**
 * Transparent, rule-based matching. Inputs are skills only.
 * Deliberately NOT used: name, origin, education, career path, languages, photo, age.
 * Output is a suggestion with a full breakdown. A human decides.
 */
export function explainMatch(need: Need, talent: Talent): MatchExplanation {
  const byId = new Map(talent.skills.map((s) => [s.id, s]));
  const shared: MatchExplanation["shared"] = [];
  const transferable: MatchExplanation["transferable"] = [];
  const gaps: MatchExplanation["gaps"] = [];
  let got = 0;
  let max = 0;

  const consider = (skill: string, must: boolean) => {
    const w = must ? MUST_WEIGHT : NICE_WEIGHT;
    max += w;
    const own = byId.get(skill);
    if (own) {
      shared.push({ skill, level: own.level, must });
      got += w * (own.level === "evidenced" ? EVIDENCED : CLAIMED);
      return;
    }
    let best = { from: "", v: 0 };
    for (const s of talent.skills) {
      const v = adjacency(s.id, skill) * (s.level === "evidenced" ? EVIDENCED : CLAIMED);
      if (v > best.v) best = { from: s.id, v };
    }
    if (best.v >= 0.3) {
      transferable.push({ from: best.from, to: skill, must });
      got += w * best.v * TRANSFER_FACTOR;
    } else {
      gaps.push({ skill, must });
    }
  };

  need.must.forEach((s) => consider(s, true));
  need.nice.forEach((s) => consider(s, false));

  const relevant = new Set([...need.must, ...need.nice, ...transferable.map((t) => t.from)]);
  const quotes = talent.evidence.filter((e) => e.skills.some((s) => relevant.has(s)));
  const score = max ? got / max : 0;

  return {
    needId: need.id,
    talentId: talent.id,
    score,
    shared,
    transferable,
    gaps,
    quotes,
    suggested: score >= SUGGEST_THRESHOLD,
  };
}

export function matchesForNeed(need: Need, pool: Talent[]) {
  return pool.map((t) => explainMatch(need, t)).sort((a, b) => b.score - a.score);
}

export const pairKey = (needId: string, talentId: string) => `${needId}::${talentId}`;

/** How many in the pool show evidence for at least `min` of the must-haves. */
export function poolCoverage(must: string[], pool: Talent[], min = Math.min(2, must.length)) {
  if (!must.length) return 0;
  return pool.filter(
    (t) => t.skills.filter((s) => s.level === "evidenced" && must.includes(s.id)).length >= min,
  ).length;
}

/**
 * Language group for the fairness audit, derived from the profile's own language list.
 * Finland's national languages (Finnish, Swedish) are what hiring bias most often keys on.
 */
export function languageGroup(t: Talent): string {
  const national = t.languages.filter((l) => l.lang === "Finnish" || l.lang === "Swedish");
  if (national.some((l) => l.level === "Native")) return "Finnish/Swedish native";
  if (national.some((l) => l.level === "Fluent" || l.level === "Working"))
    return "Finnish/Swedish as 2nd language";
  return "No Finnish/Swedish yet";
}

const AUDIT_DIMS = {
  origin: { label: "Origin", group: (t: Talent) => t.audit.origin },
  language: { label: "Language", group: languageGroup },
  education: { label: "Education", group: (t: Talent) => t.audit.education },
  path: { label: "Career path", group: (t: Talent) => t.audit.path },
} as const;

/** Aggregate suggestion rates per audit group (four-fifths rule check). */
export function biasAudit(needs: Need[], pool: Talent[]) {
  const dims = Object.keys(AUDIT_DIMS) as (keyof typeof AUDIT_DIMS)[];
  const all = needs.flatMap((n) => pool.map((t) => ({ t, m: explainMatch(n, t) })));
  return dims.map((dim) => {
    const groups = new Map<string, { pairs: number; suggested: number; people: Set<string> }>();
    for (const { t, m } of all) {
      const g = AUDIT_DIMS[dim].group(t);
      const row = groups.get(g) ?? { pairs: 0, suggested: 0, people: new Set() };
      row.pairs += 1;
      row.people.add(t.id);
      if (m.suggested) row.suggested += 1;
      groups.set(g, row);
    }
    const rows = [...groups.entries()].map(([group, r]) => ({
      group,
      people: r.people.size,
      // share of people in this group who got at least one suggestion
      rate: r.people.size
        ? [...r.people].filter((id) => all.some((x) => x.t.id === id && x.m.suggested)).length / r.people.size
        : 0,
    }));
    const maxRate = Math.max(...rows.map((r) => r.rate), 0.0001);
    const minRate = Math.min(...rows.map((r) => r.rate));
    return {
      dim,
      label: AUDIT_DIMS[dim].label,
      rows: rows.sort((a, b) => b.rate - a.rate),
      ratio: minRate / maxRate,
    };
  });
}
