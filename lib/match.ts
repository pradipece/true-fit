import { adjacency, OCCUPATIONS } from "./esco";
import type { MatchExplanation, Need, ScoreLine, Talent } from "./types";

export const SUGGEST_THRESHOLD = 0.4;

/** Every constant the score uses. Shown in the UI so the rules are inspectable. */
export const SCORING = {
  mustWeight: 3,
  niceWeight: 1,
  evidenced: 1,
  claimed: 0.5,
  transferFactor: 0.8,
  /** A related skill counts only if relation × level reaches this. */
  minTransfer: 0.3,
  suggestThreshold: SUGGEST_THRESHOLD,
} as const;

/**
 * The ONLY talent fields matching may read. Name, alias, headline, background, languages,
 * availability, way of working and the audit attributes (origin, education, career path)
 * are excluded at the type level, and tests check they are never read at runtime.
 */
export type MatchTalent = Pick<Talent, "id" | "skills" | "evidence">;
/** The only need fields matching may read. Language and way of working are not scored. */
export type MatchNeed = Pick<Need, "id" | "must" | "nice">;

/** Cached ESCO occupations whose skill profile contains both skills. */
export function sharedOccupations(a: string, b: string) {
  return OCCUPATIONS.filter((o) => o.skills.includes(a) && o.skills.includes(b)).map((o) => o.label);
}

/**
 * Transparent, rule-based matching on skills only. For each required skill:
 * - direct: the talent lists it → weight × level (evidenced 1, self-reported 0.5)
 * - transfer: a related skill → weight × relation × level × 0.8, if relation × level ≥ 0.3
 * - gap: neither → 0
 * score = points / max points. It is a suggestion with a full breakdown; a human decides.
 */
export function explainMatch(need: MatchNeed, talent: MatchTalent): MatchExplanation {
  const byId = new Map(talent.skills.map((s) => [s.id, s]));
  const breakdown: ScoreLine[] = [];
  const level = (l: "evidenced" | "claimed") => (l === "evidenced" ? SCORING.evidenced : SCORING.claimed);

  const consider = (skill: string, must: boolean) => {
    const max = must ? SCORING.mustWeight : SCORING.niceWeight;
    const own = byId.get(skill);
    if (own) {
      breakdown.push({ skill, must, kind: "direct", max, points: max * level(own.level), level: own.level });
      return;
    }
    let best = { from: "", relation: 0, v: 0, level: "claimed" as "evidenced" | "claimed" };
    for (const s of talent.skills) {
      const relation = adjacency(s.id, skill);
      const v = relation * level(s.level);
      if (v > best.v) best = { from: s.id, relation, v, level: s.level };
    }
    if (best.v >= SCORING.minTransfer) {
      breakdown.push({
        skill,
        must,
        kind: "transfer",
        max,
        points: max * best.v * SCORING.transferFactor,
        level: best.level,
        from: best.from,
        relation: best.relation,
        occupations: sharedOccupations(best.from, skill),
      });
    } else {
      breakdown.push({ skill, must, kind: "gap", max, points: 0 });
    }
  };

  need.must.forEach((s) => consider(s, true));
  need.nice.forEach((s) => consider(s, false));

  const points = breakdown.reduce((sum, l) => sum + l.points, 0);
  const maxPoints = breakdown.reduce((sum, l) => sum + l.max, 0);
  const score = maxPoints ? points / maxPoints : 0;

  const transferable = breakdown
    .filter((l) => l.kind === "transfer")
    .map((l) => ({ from: l.from!, to: l.skill, must: l.must }));
  const relevant = new Set([...need.must, ...need.nice, ...transferable.map((t) => t.from)]);

  return {
    needId: need.id,
    talentId: talent.id,
    score,
    points,
    maxPoints,
    breakdown,
    shared: breakdown
      .filter((l) => l.kind === "direct")
      .map((l) => ({ skill: l.skill, level: l.level!, must: l.must })),
    transferable,
    gaps: breakdown.filter((l) => l.kind === "gap").map((l) => ({ skill: l.skill, must: l.must })),
    // Evidence is shown to humans as context; it never changes the score.
    quotes: talent.evidence.filter((e) => e.skills.some((s) => relevant.has(s))),
    suggested: score >= SUGGEST_THRESHOLD,
  };
}

export function matchesForNeed(need: MatchNeed, pool: MatchTalent[]) {
  return pool.map((t) => explainMatch(need, t)).sort((a, b) => b.score - a.score);
}

export const pairKey = (needId: string, talentId: string) => `${needId}::${talentId}`;

/** How many in the pool show evidence for at least `min` of the must-haves. */
export function poolCoverage(must: string[], pool: Pick<Talent, "skills">[], min = Math.min(2, must.length)) {
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
