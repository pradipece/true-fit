import { SKILLS } from "./esco";
import { pairOutcome } from "./impact";
import { biasAudit, matchesForNeed, pairKey, poolCoverage } from "./match";
import type { AuditEntry, Decision, Feedback, MatchExplanation, Need, SkillGroup, Talent } from "./types";

/**
 * Human oversight by the company: reasons, the append-only audit log and the review queue.
 * Matching only suggests. People below the overlap guide are listed for review too:
 * nobody is rejected, hidden or removed automatically.
 */

export const ACTOR = "Company (demo)";

export const REASONS = {
  approve: [
    "Must-haves shown in their answers",
    "Strong transferable skills",
    "Worth a conversation despite gaps",
    "Fits how our team works",
  ],
  reject: [
    "Key must-have not shown yet",
    "We need a different level of experience",
    "Way of working or start date doesn't fit",
    "Already meeting this candidate",
  ],
  edit: ["New information from the candidate", "We changed the need card", "Correcting my earlier decision"],
} as const;

export const OTHER = "Other (explain in the note)";

/** A reason is required for every action; "Other" also requires a note. */
export function reasonError(reason: string, note: string) {
  if (!reason.trim()) return "Pick a reason.";
  if (reason === OTHER && !note.trim()) return "Explain the reason in the note.";
  return null;
}

let seq = 0;
export function auditEntry(
  key: string,
  action: AuditEntry["action"],
  from: AuditEntry["from"],
  to: AuditEntry["to"],
  reason: string,
  note?: string,
  at = new Date().toISOString(),
): AuditEntry {
  const [needId, talentId] = key.split("::");
  return {
    id: `A-${Date.parse(at).toString(36)}-${(seq++).toString(36)}`,
    at,
    actor: ACTOR,
    action,
    needId,
    talentId,
    from,
    to,
    reason,
    note: note?.trim() || undefined,
  };
}

/** The action to log when a decision changes from `prev` to `next`. */
export function actionFor(prev: Decision | undefined, next: Decision["status"]): AuditEntry["action"] {
  if (!prev) return next;
  return "edited";
}

/** Everyone in the pool for a need: suggestions first, then the rest, still open for review. */
export function reviewList(need: Need, pool: Talent[]) {
  const all = matchesForNeed(need, pool);
  return { suggested: all.filter((m) => m.suggested), notSuggested: all.filter((m) => !m.suggested), all };
}

export type Overview = {
  needs: number;
  needsEarly: number;
  pool: number;
  awaitingReview: number;
  approved: number;
  rejected: number;
  meetings: number;
  mutual: number;
};

export function overview(
  needs: Need[],
  pool: Talent[],
  decisions: Record<string, Decision>,
  optIns: Record<string, { company?: boolean; talent?: boolean }>,
  slots: Record<string, string>,
): Overview {
  const suggested: MatchExplanation[] = needs.flatMap((n) =>
    matchesForNeed(n, pool).filter((m) => m.suggested),
  );
  const ds = Object.values(decisions);
  return {
    needs: needs.length,
    needsEarly: needs.filter((n) => n.submittedWeeksBefore >= 2).length,
    pool: pool.length,
    awaitingReview: suggested.filter((m) => !decisions[pairKey(m.needId, m.talentId)]).length,
    approved: ds.filter((d) => d.status === "approved").length,
    rejected: ds.filter((d) => d.status === "rejected").length,
    meetings: Object.keys(slots).length,
    mutual: Object.values(optIns).filter((o) => o.company && o.talent).length,
  };
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The audit log as CSV, oldest first, with readable need and candidate names. */
export function auditCsv(entries: AuditEntry[], needs: Need[], pool: Talent[]) {
  const needName = new Map(needs.map((n) => [n.id, `${n.title} · ${n.company}`]));
  const alias = new Map(pool.map((t) => [t.id, t.alias]));
  const header = ["time", "actor", "action", "need", "candidate", "from", "to", "reason", "note"];
  const rows = [...entries]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => [
      e.at,
      e.actor,
      e.action,
      needName.get(e.needId) ?? e.needId,
      alias.get(e.talentId) ?? e.talentId,
      e.from,
      e.to,
      e.reason,
      e.note ?? "",
    ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

// ── Dashboard data (plain numbers for the overview charts) ─────────────────

/** From suggestion to meeting: each stage counts pairs that reached it. */
export function funnel(
  needs: Need[],
  pool: Talent[],
  decisions: Record<string, Decision>,
  optIns: Record<string, { company?: boolean; talent?: boolean }>,
  slots: Record<string, string>,
  feedback: Record<string, Feedback>,
) {
  const approved = Object.entries(decisions)
    .filter(([, d]) => d.status === "approved")
    .map(([k]) => k);
  const both = approved.filter((k) => optIns[k]?.company && optIns[k]?.talent);
  return [
    {
      stage: "Suggested by skills",
      value: needs.flatMap((n) => matchesForNeed(n, pool).filter((m) => m.suggested)).length,
    },
    { stage: "Approved by you", value: approved.length },
    { stage: "Both said yes", value: both.length },
    { stage: "Meeting booked", value: both.filter((k) => slots[k]).length },
    {
      stage: "Meeting held",
      value: both.filter((k) => slots[k] && (feedback[k]?.company?.held || feedback[k]?.talent?.held)).length,
    },
    {
      stage: "Follow-up agreed",
      value: both.filter((k) => ["interview", "follow-up"].includes(pairOutcome(feedback[k]))).length,
    },
  ];
}

export type Supply = "good" | "few" | "none";

/** Can the pool fill each need? Relevant = at or above the overlap guide. */
export function needSupply(needs: Need[], pool: Talent[], decisions: Record<string, Decision>) {
  return needs.map((n) => {
    const suggested = matchesForNeed(n, pool).filter((m) => m.suggested);
    const relevant = suggested.length;
    return {
      need: n,
      relevant,
      evidenced: poolCoverage(n.must, pool),
      toReview: suggested.filter((m) => !decisions[pairKey(m.needId, m.talentId)]).length,
      supply: (relevant >= 3 ? "good" : relevant > 0 ? "few" : "none") as Supply,
    };
  });
}

const GROUPS: SkillGroup[] = ["Digital", "Green transition", "Healthcare", "Business", "Transversal"];

/** Who is in the pool, by skill area and top skills. Counts only. */
export function poolProfile(pool: Talent[]) {
  const has = (t: Talent, ids: string[]) => t.skills.some((s) => ids.includes(s.id));
  return {
    areas: GROUPS.map((g) => ({
      area: g,
      people: pool.filter((t) =>
        has(
          t,
          SKILLS.filter((s) => s.group === g).map((s) => s.id),
        ),
      ).length,
    })),
    topSkills: SKILLS.map((s) => ({
      skill: s.id,
      people: pool.filter((t) => has(t, [s.id])).length,
      evidenced: pool.filter((t) => t.skills.some((x) => x.id === s.id && x.level === "evidenced")).length,
    }))
      .filter((s) => s.people > 0)
      .sort((a, b) => b.people - a.people)
      .slice(0, 8),
    evidencedShare: pool.length
      ? pool.filter((t) => t.skills.some((s) => s.level === "evidenced")).length / pool.length
      : 0,
  };
}

/** Fairness snapshot in plain words: is each group suggested at a similar rate? */
export function fairnessSummary(needs: Need[], pool: Talent[]) {
  return biasAudit(needs, pool).map((a) => ({
    dimension: a.label,
    ratio: a.ratio,
    ok: a.ratio >= 0.8,
    lowest: a.rows[a.rows.length - 1],
    highest: a.rows[0],
  }));
}
