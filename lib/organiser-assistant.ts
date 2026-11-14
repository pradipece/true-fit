import { impactMetrics } from "./impact";
import { matchesForNeed, pairKey } from "./match";
import { fairnessSummary } from "./oversight";
import { rooms, SLOT_TIMES, companyOf } from "./schedule";
import type { Decision, Feedback, Need, Talent } from "./types";

/**
 * The Espoo Esbo assistant: a chat for the organiser (the event's broker) that answers
 * questions about how the event is going and where to look next. It only ever sees an
 * aggregate snapshot of the event (counts per company need, totals, fairness ratios),
 * never a candidate's name, id, skills or answers. It points to pages; it never
 * introduces, passes or decides anything.
 */

export type NeedSnapshot = {
  title: string;
  company: string;
  /** People at or above the suggestion line. */
  suggested: number;
  /** Suggested people with no organiser decision yet. */
  toReview: number;
  introduced: number;
  notNow: number;
  /** Open requests: candidates who asked to meet, companies who asked for an introduction. */
  candidateRequests: number;
  companyRequests: number;
  weeksBefore: number;
};

export type EventSnapshot = {
  people: number;
  companies: number;
  needs: NeedSnapshot[];
  introductions: {
    total: number;
    waitingForBoth: number;
    waitingForCompany: number;
    waitingForCandidate: number;
    bothYes: number;
    declined: number;
    booked: number;
  };
  schedule: { tables: number; slots: number; booked: number };
  fairness: { dimension: string; ratio: number; ok: boolean }[];
  feedback: { held: number; noShows: number; followUps: number; interviews: number };
};

type State = {
  needs: Need[];
  talent: Talent[];
  decisions: Record<string, Decision>;
  optIns: Record<string, { company?: boolean; talent?: boolean }>;
  slots: Record<string, string>;
  feedback: Record<string, Feedback>;
};

/** Counts only. Built in the browser from the demo state and sent with each question. */
export function eventSnapshot({ needs, talent, decisions, optIns, slots, feedback }: State): EventSnapshot {
  const intro = Object.entries(decisions)
    .filter(([, d]) => d.status === "approved")
    .map(([k]) => k);
  const o = (k: string) => optIns[k] ?? {};
  const declined = intro.filter((k) => o(k).company === false || o(k).talent === false);
  const open = intro.filter((k) => !declined.includes(k));
  const impact = impactMetrics(slots, feedback);
  const tables = rooms(needs).filter((r) => needs.some((n) => companyOf(n) === r.companyId));

  return {
    people: talent.length,
    companies: new Set(needs.map(companyOf)).size,
    needs: needs.map((n) => {
      const suggested = matchesForNeed(n, talent).filter((m) => m.suggested);
      const keys = talent.map((t) => pairKey(n.id, t.id));
      return {
        title: n.title,
        company: n.company,
        suggested: suggested.length,
        toReview: suggested.filter((m) => !decisions[pairKey(m.needId, m.talentId)]).length,
        introduced: keys.filter((k) => decisions[k]?.status === "approved").length,
        notNow: keys.filter((k) => decisions[k]?.status === "rejected").length,
        candidateRequests: keys.filter((k) => !decisions[k] && o(k).talent === true).length,
        companyRequests: keys.filter((k) => !decisions[k] && o(k).company === true).length,
        weeksBefore: n.submittedWeeksBefore,
      };
    }),
    introductions: {
      total: intro.length,
      waitingForBoth: open.filter((k) => o(k).company === undefined && o(k).talent === undefined).length,
      waitingForCompany: open.filter((k) => o(k).talent === true && o(k).company === undefined).length,
      waitingForCandidate: open.filter((k) => o(k).company === true && o(k).talent === undefined).length,
      bothYes: open.filter((k) => o(k).company === true && o(k).talent === true).length,
      declined: declined.length,
      booked: intro.filter((k) => slots[k]).length,
    },
    schedule: {
      tables: tables.length,
      slots: tables.length * SLOT_TIMES.length,
      booked: Object.keys(slots).length,
    },
    fairness: fairnessSummary(needs, talent).map((f) => ({
      dimension: f.dimension,
      ratio: Math.round(f.ratio * 100) / 100,
      ok: f.ok,
    })),
    feedback: {
      held: impact.held,
      noShows: impact.noShows,
      followUps: impact.followUps,
      interviews: impact.interviews,
    },
  };
}

// ── Validation (the server never trusts the browser's snapshot) ─────────────

const int = (v: unknown, max = 10_000) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0;
const str = (v: unknown, max = 80) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Keep only the known aggregate fields, clamped. Anything else in the body is dropped. */
export function sanitizeSnapshot(raw: unknown): EventSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const i = (r.introductions ?? {}) as Record<string, unknown>;
  const s = (r.schedule ?? {}) as Record<string, unknown>;
  const f = (r.feedback ?? {}) as Record<string, unknown>;
  const needs = (Array.isArray(r.needs) ? r.needs : []).slice(0, 40).map((x) => {
    const n = (x ?? {}) as Record<string, unknown>;
    return {
      title: str(n.title) || "Untitled role",
      company: str(n.company) || "A company",
      suggested: int(n.suggested),
      toReview: int(n.toReview),
      introduced: int(n.introduced),
      notNow: int(n.notNow),
      candidateRequests: int(n.candidateRequests),
      companyRequests: int(n.companyRequests),
      weeksBefore: int(n.weeksBefore, 52),
    };
  });
  return {
    people: int(r.people),
    companies: int(r.companies),
    needs,
    introductions: {
      total: int(i.total),
      waitingForBoth: int(i.waitingForBoth),
      waitingForCompany: int(i.waitingForCompany),
      waitingForCandidate: int(i.waitingForCandidate),
      bothYes: int(i.bothYes),
      declined: int(i.declined),
      booked: int(i.booked),
    },
    schedule: { tables: int(s.tables), slots: int(s.slots), booked: int(s.booked) },
    fairness: (Array.isArray(r.fairness) ? r.fairness : []).slice(0, 8).map((x) => {
      const d = (x ?? {}) as Record<string, unknown>;
      const ratio =
        typeof d.ratio === "number" && Number.isFinite(d.ratio) ? Math.max(0, Math.min(1, d.ratio)) : 1;
      return { dimension: str(d.dimension, 40) || "Group", ratio, ok: ratio >= 0.8 };
    }),
    feedback: {
      held: int(f.held),
      noShows: int(f.noShows),
      followUps: int(f.followUps),
      interviews: int(f.interviews),
    },
  };
}

// ── Gemini contract ──────────────────────────────────────────────────────────

/** The only pages the assistant may link to. */
export const ASSISTANT_LINKS = {
  review: { label: "Review introductions", href: "/organiser" },
  insights: { label: "Event insights", href: "/organiser/insights" },
  responsible: { label: "Responsible AI and fairness", href: "/responsible" },
} as const;
export type LinkId = keyof typeof ASSISTANT_LINKS;

export const STARTERS = [
  "What needs my attention first?",
  "Which needs have too few candidates?",
  "Any open requests to introduce?",
  "Is the matching fair across groups?",
  "How full is the schedule?",
];

export type AssistantReply = { reply: string; links: LinkId[]; suggestions: string[] };

export const ASSISTANT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string", description: "Plain-language answer, at most about 120 words." },
    links: { type: "array", items: { type: "string", enum: Object.keys(ASSISTANT_LINKS) }, maxItems: 2 },
    suggestions: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
      description: "Short follow-up questions the organiser might ask next, in their voice.",
    },
  },
  required: ["reply", "links", "suggestions"],
};

export const ASSISTANT_SYSTEM_PROMPT = `You are the Espoo Esbo assistant in TrueFit, helping the City of Espoo event team run a recruitment and matchmaking event. The team is the broker: it reviews skill matches and introduces job seekers to companies; the company and the candidate then each say yes or no.

You get an <event_snapshot> with aggregate counts only: per company need (suggested people, still to review, introduced, not now, open requests from candidates and from companies), introduction progress, schedule load, fairness ratios (four-fifths rule: below 0.8 needs a closer look) and feedback totals.

Rules:
- Answer only from the snapshot. If something isn't in it, say so; never invent numbers, names or people.
- You know nothing about individual candidates and must not guess about any. Never rank, judge or recommend specific people.
- You never decide. Point the team to where they decide: "review" (Introductions page), "insights" (charts), "responsible" (fairness and AI Act). Only link when it helps.
- Be brief and concrete: lead with the answer, name the company needs and numbers that matter, and suggest a next step. Plain words: "skill match", "people at this event", not "pool" or "ESCO".
- Matching uses skills only. If asked to filter by nationality, language, age, gender, education or career path, explain that the tool doesn't do that and why.
- Reply in the language the team writes in (English, Finnish or Swedish).`;

export function sanitizeReply(out: Partial<AssistantReply>): AssistantReply | null {
  const reply = str(out.reply, 1200);
  if (!reply) return null;
  const links = [...new Set((out.links ?? []).filter((l): l is LinkId => l in ASSISTANT_LINKS))].slice(0, 2);
  const suggestions = (out.suggestions ?? [])
    .map((x) => str(x, 90))
    .filter(Boolean)
    .slice(0, 3);
  return { reply, links, suggestions };
}

// ── Rules fallback (no key, offline or Gemini error) ────────────────────────

const pl = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const need = (n: NeedSnapshot) => `${n.title} (${n.company})`;

/** Deterministic answers from the same snapshot, by topic keywords. */
export function rulesReply(question: string, s: EventSnapshot): AssistantReply {
  const q = question.toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const i = s.introductions;

  if (has("fair", "bias", "group", "equal", "reiluu", "rättvis")) {
    const low = s.fairness.filter((f) => !f.ok);
    return {
      reply: low.length
        ? `Worth a closer look: ${low.map((f) => `${f.dimension} (ratio ${f.ratio.toFixed(2)})`).join(", ")} is below the four-fifths line of 0.80, so one group gets suggested less often. Check the passes for that group and whether the needs fit the people at this event. Matching itself uses skills only.`
        : `All ${pl(s.fairness.length, "group check")} are at or above the four-fifths line (lowest ${Math.min(...s.fairness.map((f) => f.ratio), 1).toFixed(2)}). Matching uses skills only; keep an eye on it as more people join.`,
      links: ["responsible"],
      suggestions: ["What needs my attention first?"],
    };
  }
  if (has("request", "asked", "ask", "pyyn", "begär")) {
    const rs = s.needs.filter((n) => n.candidateRequests + n.companyRequests > 0);
    return {
      reply: rs.length
        ? `Open requests: ${rs.map((n) => `${need(n)}: ${[n.candidateRequests && pl(n.candidateRequests, "candidate"), n.companyRequests && `${pl(n.companyRequests, "company request")}`].filter(Boolean).join(", ")}`).join("; ")}. They're flagged on the Introductions page; a request never changes the skill match.`
        : "No open requests right now. Candidates ask on Explore roles and companies on Find candidates; they show up as badges on the Introductions page.",
      links: ["review"],
      suggestions: ["What needs my attention first?"],
    };
  }
  if (has("few", "short", "hard", "supply", "fill", "nobody", "too")) {
    const thin = [...s.needs].sort((a, b) => a.suggested - b.suggested).filter((n) => n.suggested < 3);
    return {
      reply: thin.length
        ? `Needs with fewer than three strong fits: ${thin.map((n) => `${need(n)}: ${n.suggested}`).join("; ")}. Ask those companies whether a rare must-have could be nice-to-have, or reach out to matching people who haven't registered yet.`
        : `Every need has at least three people at the event with a strong skill match (out of ${pl(s.people, "person", "people")}).`,
      links: ["insights"],
      suggestions: ["Any open requests to introduce?"],
    };
  }
  if (has("schedule", "slot", "book", "full", "time", "table", "aika")) {
    const pct = s.schedule.slots ? Math.round((s.schedule.booked / s.schedule.slots) * 100) : 0;
    return {
      reply:
        `${pl(s.schedule.booked, "meeting")} booked across ${pl(s.schedule.tables, "table")}, ${pct}% of meeting time. ${i.bothYes ? `${pl(i.bothYes, "pair")} said yes on both sides and can book now.` : ""} ${i.waitingForBoth + i.waitingForCompany + i.waitingForCandidate} introductions are still waiting for an answer.`.trim(),
      links: ["insights"],
      suggestions: ["What needs my attention first?"],
    };
  }
  if (has("feedback", "held", "no-show", "interview", "after")) {
    return {
      reply: `${pl(s.feedback.held, "meeting")} held, ${pl(s.feedback.noShows, "no-show")}, ${pl(s.feedback.followUps, "follow-up")} with interest from both sides and ${pl(s.feedback.interviews, "interview")} agreed.`,
      links: ["insights"],
      suggestions: ["How full is the schedule?"],
    };
  }

  // Default: what needs attention first.
  const review = [...s.needs].sort((a, b) => b.toReview - a.toReview).filter((n) => n.toReview > 0);
  const requests = s.needs.reduce((x, n) => x + n.candidateRequests + n.companyRequests, 0);
  const parts = [
    review.length
      ? `${pl(
          review.reduce((x, n) => x + n.toReview, 0),
          "suggested match",
          "suggested matches",
        )} to review, most for ${review
          .slice(0, 2)
          .map((n) => `${need(n)} (${n.toReview})`)
          .join(" and ")}.`
      : "Every suggested match has a decision.",
    requests ? `${pl(requests, "open request")} to introduce.` : "",
    i.waitingForCompany
      ? `${pl(i.waitingForCompany, "introduction")} waiting for the company to answer.`
      : "",
    s.fairness.some((f) => !f.ok) ? "One fairness check is below 0.80." : "",
  ].filter(Boolean);
  return {
    reply: parts.join(" "),
    links: ["review"],
    suggestions: ["Which needs have too few candidates?", "Is the matching fair across groups?"],
  };
}
