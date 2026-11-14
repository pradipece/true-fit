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

export type InterestStatus = "none" | "asked" | "invited" | "both" | "booked" | "passed" | "declined";

/** Where a candidate stands with one role, from their own point of view. */
export function interestStatus(
  optIn: { company?: boolean; talent?: boolean } | undefined,
  decision: { status: "approved" | "rejected" } | undefined,
  slot: string | undefined,
): InterestStatus {
  if (optIn?.talent === false) return "declined";
  if (decision?.status === "rejected" || optIn?.company === false) return "passed";
  // Only a standing invitation counts: an invite that was withdrawn leaves company: true behind.
  const invited = decision?.status === "approved";
  if (invited && optIn?.talent) return slot ? "booked" : "both";
  if (invited) return "invited";
  if (optIn?.talent) return "asked";
  return "none";
}
