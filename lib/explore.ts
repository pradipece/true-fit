import { myTurn, type PairStage } from "./pipeline";
import { adjacency } from "./esco";
import { explainMatch, type MatchNeed, type MatchTalent } from "./match";
import type { MatchExplanation, SkillClaim } from "./types";

/**
 * Reverse matching for job seekers: the same transparent, skills-only rules the
 * companies see, turned around so a candidate can look at every role at the event,
 * see how to strengthen their own card, and ask to meet. Like the scorer, these
 * helpers only accept `MatchNeed` / `MatchTalent`, so no protected field can be read.
 */

/** Roles ranked by skill match for one candidate, best first. */
export function rolesFor<N extends MatchNeed>(needs: N[], talent: MatchTalent) {
  return needs.map((need) => ({ need, m: explainMatch(need, talent) })).sort((a, b) => b.m.score - a.m.score);
}

export type CompanyFit<N> = {
  /** The company's id (its needs' `companyId`; needs made in the demo belong to "C-YOU"). */
  companyId: string;
  /** The company's best role for this candidate, which sets its rank. */
  best: { need: N; m: MatchExplanation };
  /** All of the company's roles, best match first. */
  roles: { need: N; m: MatchExplanation }[];
  /** Roles at or above the suggestion line. */
  strong: number;
};

/**
 * Companies ranked for one candidate: each company by its best-matching role, then by how
 * many of its roles are strong fits, then by name. Same skills-only score as everywhere
 * else; the company fields are only used to group, never to score.
 */
export function companiesFor<N extends MatchNeed & { companyId?: string; company: string }>(
  needs: N[],
  talent: MatchTalent,
): CompanyFit<N>[] {
  const groups = new Map<string, { need: N; m: MatchExplanation }[]>();
  for (const r of rolesFor(needs, talent)) {
    const id = r.need.companyId ?? "C-YOU";
    groups.set(id, [...(groups.get(id) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([companyId, roles]) => ({
      companyId,
      best: roles[0],
      roles,
      strong: roles.filter((r) => r.m.suggested).length,
    }))
    .sort(
      (a, b) =>
        b.best.m.score - a.best.m.score ||
        b.strong - a.strong ||
        a.best.need.company.localeCompare(b.best.need.company),
    );
}

export type ProofBoost = {
  /** Stated skills that, once shown in an answer, raise the match. */
  skills: string[];
  before: number;
  after: number;
};

/**
 * "Show, don't tell": what the match would be if every stated (not shown) skill this
 * role relies on were backed by an answer, voice note or work sample. Null when proof
 * would not change anything.
 */
export function proofBoost(need: MatchNeed, talent: MatchTalent, base?: MatchExplanation): ProofBoost | null {
  const m = base ?? explainMatch(need, talent);
  const used = new Set(
    m.breakdown
      .filter((l) => l.level === "claimed" && l.kind !== "gap")
      .map((l) => (l.kind === "direct" ? l.skill : l.from!)),
  );
  if (!used.size) return null;
  const proven: MatchTalent = {
    ...talent,
    skills: talent.skills.map((s) => (used.has(s.id) ? { ...s, level: "evidenced" } : s)),
  };
  const after = explainMatch(need, proven).score;
  if (after - m.score < 0.005) return null;
  return { skills: [...used], before: m.score, after };
}

export type Unlock = {
  skill: string;
  /** Roles that would cross the suggestion line with this skill shown. */
  opened: string[];
  /** Total skill-match gain across all roles (0..n). */
  gain: number;
  /** The candidate's own skill closest to it, if any: a head start for learning. */
  buildsOn?: { skill: string; relation: number };
};

/**
 * The missing skills that would open the most roles at this event if the candidate
 * learned and showed them. Ranked by roles opened, then by total match gain. It is
 * advice for the candidate only, never used to rank them.
 */
export function unlockSkills(needs: MatchNeed[], talent: MatchTalent, limit = 3): Unlock[] {
  const have = new Set(talent.skills.map((s) => s.id));
  const base = new Map(needs.map((n) => [n.id, explainMatch(n, talent)]));
  const missing = [...new Set(needs.flatMap((n) => [...n.must, ...n.nice]))].filter((s) => !have.has(s));

  return missing
    .map((skill) => {
      const added: SkillClaim = { id: skill, level: "evidenced" };
      const plus: MatchTalent = { ...talent, skills: [...talent.skills, added] };
      let gain = 0;
      const opened: string[] = [];
      for (const n of needs) {
        const before = base.get(n.id)!;
        const after = explainMatch(n, plus);
        gain += after.score - before.score;
        if (after.suggested && !before.suggested) opened.push(n.id);
      }
      let buildsOn: Unlock["buildsOn"];
      for (const s of talent.skills) {
        const relation = adjacency(s.id, skill);
        if (relation > (buildsOn?.relation ?? 0)) buildsOn = { skill: s.id, relation };
      }
      return { skill, opened, gain, buildsOn };
    })
    .filter((u) => u.gain > 0.001)
    .sort((a, b) => b.opened.length - a.opened.length || b.gain - a.gain || a.skill.localeCompare(b.skill))
    .slice(0, limit);
}

export type InterestStatus = "none" | "asked" | "action" | "progress" | "hired" | "passed" | "declined";

/** Where a candidate stands with one role, from their own point of view (lib/pipeline.ts). */
export function interestStatus(p: PairStage): InterestStatus {
  if (p.stage === "none") return "none";
  if (p.stage === "applied") return "asked";
  if (p.hired) return "hired";
  if (p.stopped)
    return ["screen-declined", "candidate-declined", "offer-declined"].includes(p.stage)
      ? "declined"
      : "passed";
  return myTurn("talent", p) ? "action" : "progress";
}
