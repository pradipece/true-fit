import { skillLabel } from "./esco";
import { impactMetrics } from "./impact";
import { matchesForNeed, pairKey } from "./match";
import { fairnessSummary, funnel, overview, poolProfile } from "./oversight";
import { companyOf, rooms, SLOT_TIMES } from "./schedule";
import type { PipelineState } from "./pipeline";
import type { Decision, Feedback, Need, Talent } from "./types";

/**
 * Numbers for the organiser's Insights page. Everything is an aggregate count or average:
 * nothing here ranks, scores or lists individual people.
 */
export type DashboardInput = {
  needs: Need[];
  talent: Talent[];
  decisions: Record<string, Decision>;
  optIns: Record<string, { company?: boolean; talent?: boolean }>;
  slots: Record<string, string>;
  screening: PipelineState["screening"];
  offers: PipelineState["offers"];
  feedback: Record<string, Feedback>;
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export function dashboardData({
  needs,
  talent,
  decisions,
  optIns,
  slots,
  screening,
  offers,
  feedback,
}: DashboardInput) {
  const o = overview(needs, talent, decisions, optIns, slots);
  const stages = funnel(needs, talent, { decisions, optIns, slots, screening, offers });
  const profile = poolProfile(talent);
  const impact = impactMetrics(slots, feedback);

  // Only tables that have at least one need take meetings.
  const tables = rooms(needs).filter((r) => needs.some((n) => companyOf(n) === r.companyId));
  const bookedAt = Object.values(slots);
  const capacity = tables.length * SLOT_TIMES.length;

  const decisionsPerNeed = needs.map((n) => {
    const suggested = matchesForNeed(n, talent).filter((m) => m.suggested);
    const mine = Object.entries(decisions).filter(([k]) => k.startsWith(`${n.id}::`));
    return {
      id: n.id,
      label: n.title,
      sub: n.company,
      approved: mine.filter(([, d]) => d.status === "approved").length,
      rejected: mine.filter(([, d]) => d.status === "rejected").length,
      waiting: suggested.filter((m) => !decisions[pairKey(m.needId, m.talentId)]).length,
    };
  });

  return {
    tiles: {
      registered: {
        value: talent.length,
        sub: `${Math.round(profile.evidencedShare * 100)}% have shown a skill`,
      },
      needs: { value: needs.length, sub: `from ${new Set(needs.map(companyOf)).size} companies` },
      suggested: { value: stages[0].value, sub: "pairs with a good skill match" },
      waiting: { value: o.awaitingReview, sub: "waiting for an introduction decision" },
      booked: { value: bookedAt.length, sub: `${pct(bookedAt.length, capacity)}% of meeting time used` },
      followUps: {
        value: impact.followUps,
        sub: `after ${impact.held} ${impact.held === 1 ? "meeting" : "meetings"} held`,
      },
    },
    funnel: stages.map((s, i) => ({
      ...s,
      /** Share of the previous stage that made it here. */
      fromPrevious: i === 0 ? null : pct(s.value, stages[i - 1].value),
    })),
    decisionsPerNeed,
    slotLoad: {
      tables: tables.length,
      slots: SLOT_TIMES.map((time) => ({ time, booked: bookedAt.filter((t) => t === time).length })),
    },
    skills: profile.topSkills.map((s) => ({
      id: s.skill,
      label: skillLabel(s.skill),
      shown: s.evidenced,
      stated: s.people - s.evidenced,
    })),
    areas: profile.areas,
    fairness: fairnessSummary(needs, talent),
    feedback: {
      held: impact.held,
      noShows: impact.noShows,
      interviews: impact.interviews,
      responseRate: impact.responseRate,
      ratings: [
        { label: "Companies: meeting worth the time", value: impact.satisfaction.company },
        { label: "Job seekers: meeting worth the time", value: impact.satisfaction.talent },
        { label: "Skill cards matched the person", value: impact.accuracy.skillCards },
        { label: "Need cards matched the role", value: impact.accuracy.needCards },
      ],
    },
  };
}

export type Dashboard = ReturnType<typeof dashboardData>;
