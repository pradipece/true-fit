import type { OptIn } from "./schedule";
import type { Decision, Feedback, Need } from "./types";

/**
 * The recruitment pipeline for one pair (a company need × a candidate), as the City of Espoo
 * runs it:
 *
 *   1. Applied or matched: the candidate asks to meet (Explore roles), the company asks for
 *      someone (Find candidates), or the organiser spots the skill match itself.
 *   2. Espoo assessment: the organiser reviews the skill match and, with a reason, invites the
 *      candidate to a short Espoo interview (or passes for now).
 *   3. Espoo interview: the candidate accepts, books a slot, and the organiser records whether
 *      they passed, with a reason.
 *   4. Profile sent to the company: only after a pass does the company see the candidate's
 *      profile and contact details, and decide whether to interview.
 *   5. Company interview: the candidate says yes too, either side books a slot, both give feedback.
 *   6. Job offer: the company offers the job (or not) and the candidate accepts or declines.
 *
 * Every step is a human decision; the skill match only suggests. Pure functions, no React.
 */

export type Screening = {
  /** The candidate's answer to Espoo's interview invitation. */
  answer?: boolean;
  /** Espoo interview time on the event day. */
  slot?: string;
  /** The organiser's result after the Espoo interview, always with a reason. */
  result?: "passed" | "not-passed";
  reason?: string;
  note?: string;
  at?: string;
};

export type Offer = {
  status: "offered" | "no-offer";
  note?: string;
  at: string;
  /** The candidate's answer to an offer. */
  answer?: boolean;
  answeredAt?: string;
};

export type PipelineState = {
  decisions: Record<string, Decision>;
  optIns: Record<string, OptIn>;
  slots: Record<string, string>;
  screening: Record<string, Screening>;
  offers: Record<string, Offer>;
  feedback?: Record<string, Feedback>;
};

export const STEPS = [
  { id: "apply", label: "Applied or matched" },
  { id: "assess", label: "Espoo assessment" },
  { id: "screen", label: "Espoo interview" },
  { id: "shared", label: "Profile sent to company" },
  { id: "interview", label: "Company interview" },
  { id: "offer", label: "Job offer" },
] as const;

export type Stage =
  | "none"
  | "applied"
  | "not-selected"
  | "invited"
  | "screen-declined"
  | "screen-to-book"
  | "screen-booked"
  | "not-passed"
  | "shared"
  | "company-passed"
  | "interview-invited"
  | "candidate-declined"
  | "interview-to-book"
  | "interview-booked"
  | "no-offer"
  | "offered"
  | "hired"
  | "offer-declined";

export type Waiting = "organiser" | "candidate" | "company" | "either" | null;

export type PairStage = {
  stage: Stage;
  /** Index into STEPS of the step this pair is on (or stopped at). */
  step: number;
  /** The pipeline ended here without a hire. */
  stopped: boolean;
  /** The candidate accepted an offer. */
  hired: boolean;
  /** Whose move it is. */
  waiting: Waiting;
};

const at = (stage: Stage, step: number, waiting: Waiting, stopped = false): PairStage => ({
  stage,
  step,
  waiting,
  stopped,
  hired: stage === "hired",
});

export function stageOf(key: string, s: PipelineState): PairStage {
  const d = s.decisions[key];
  const o = s.optIns[key] ?? {};
  const sc = s.screening[key] ?? {};
  const offer = s.offers[key];
  if (!d) return o.talent || o.company ? at("applied", 1, "organiser") : at("none", 0, "organiser");
  if (d.status === "rejected") return at("not-selected", 1, null, true);
  if (sc.answer === false) return at("screen-declined", 2, null, true);
  if (sc.answer !== true) return at("invited", 2, "candidate");
  if (!sc.result) return sc.slot ? at("screen-booked", 2, "organiser") : at("screen-to-book", 2, "candidate");
  if (sc.result === "not-passed") return at("not-passed", 2, null, true);
  if (o.company === false) return at("company-passed", 3, null, true);
  if (o.company !== true) return at("shared", 3, "company");
  if (o.talent === false) return at("candidate-declined", 4, null, true);
  if (o.talent !== true) return at("interview-invited", 4, "candidate");
  if (!s.slots[key]) return at("interview-to-book", 4, "either");
  if (!offer) return at("interview-booked", 4, "company");
  if (offer.status === "no-offer") return at("no-offer", 5, null, true);
  if (offer.answer === undefined) return at("offered", 5, "candidate");
  return offer.answer ? at("hired", 5, null) : at("offer-declined", 5, null, true);
}

/** Plain-language status, as the organiser sees it. */
export const STAGE_LABEL: Record<Stage, string> = {
  none: "No activity",
  applied: "Asked to meet · waiting for Espoo to assess",
  "not-selected": "Espoo passed for now",
  invited: "Invited to Espoo interview · waiting for the candidate",
  "screen-declined": "Candidate declined the Espoo interview",
  "screen-to-book": "Accepted · candidate to book the Espoo interview",
  "screen-booked": "Espoo interview booked · result to record",
  "not-passed": "Didn't pass the Espoo interview",
  shared: "Profile sent to the company · waiting for its decision",
  "company-passed": "Company decided not to interview",
  "interview-invited": "Company wants to interview · waiting for the candidate",
  "candidate-declined": "Candidate declined the company interview",
  "interview-to-book": "Both said yes · interview time to book",
  "interview-booked": "Company interview booked · offer decision pending",
  "no-offer": "No job offer this time",
  offered: "Job offer made · waiting for the candidate",
  hired: "Offer accepted · hired",
  "offer-declined": "Candidate declined the offer",
};

/** Where the pair stands for one step: done, the current one, stopped here, or not reached. */
export function stepState(p: PairStage, i: number): "done" | "current" | "stopped" | "todo" {
  if (i < p.step) return "done";
  if (i > p.step) return "todo";
  if (p.hired) return "done";
  return p.stopped ? "stopped" : "current";
}

/** The pair belongs to this participant on that side (company id or candidate id). */
export function ownedBy(
  side: "company" | "talent",
  id: string,
  key: string,
  needs: Pick<Need, "id" | "companyId">[],
) {
  const [needId, talentId] = key.split("::");
  if (side === "talent") return talentId === id;
  const need = needs.find((n) => n.id === needId);
  return (need?.companyId ?? "C-YOU") === id;
}

/** Every pair with any activity: an application, a request or an organiser decision. */
export function activeKeys(s: Pick<PipelineState, "decisions" | "optIns">) {
  const keys = new Set(Object.keys(s.decisions));
  for (const [k, o] of Object.entries(s.optIns)) if (o.company || o.talent) keys.add(k);
  return [...keys];
}

/**
 * What a side can see of a pair. The candidate sees every pair of theirs from the Espoo
 * invitation on (and their own applications). The company sees a candidate's profile only
 * after Espoo passes them; before that, only its own requests and their stage.
 */
export function visibleTo(side: "company" | "talent", key: string, s: PipelineState) {
  const p = stageOf(key, s);
  if (p.stage === "none") return false;
  if (side === "talent") return p.stage !== "applied" || s.optIns[key]?.talent === true;
  return p.step >= 3;
}

/** Whose turn it is, from one side's point of view. */
export function myTurn(side: "company" | "talent", p: PairStage) {
  return p.waiting === "either" || p.waiting === (side === "talent" ? "candidate" : "company");
}

/** The candidate's own short label for a pair. */
export const TALENT_LABEL: Record<Stage, string> = {
  none: "",
  applied: "Waiting for Espoo to review",
  "not-selected": "Not this time",
  invited: "Espoo invites you to an interview",
  "screen-declined": "You declined",
  "screen-to-book": "Book your Espoo interview",
  "screen-booked": "Espoo interview booked",
  "not-passed": "Not this time",
  shared: "Profile sent to the company",
  "company-passed": "The company won't interview this time",
  "interview-invited": "The company wants to interview you",
  "candidate-declined": "You declined the interview",
  "interview-to-book": "Book your company interview",
  "interview-booked": "Company interview booked",
  "no-offer": "No offer this time",
  offered: "Job offer! Your answer",
  hired: "You accepted the offer",
  "offer-declined": "You declined the offer",
};

/** The company's own short label for a pair. */
export const COMPANY_LABEL: Record<Stage, string> = {
  none: "",
  applied: "Your request · Espoo is assessing",
  "not-selected": "Espoo didn't take this forward",
  invited: "Espoo invited them to an interview",
  "screen-declined": "Not going ahead",
  "screen-to-book": "Espoo interview being booked",
  "screen-booked": "Espoo interview booked",
  "not-passed": "Espoo didn't take this forward",
  shared: "Passed Espoo · your decision",
  "company-passed": "You decided not to interview",
  "interview-invited": "Waiting for the candidate",
  "candidate-declined": "The candidate declined",
  "interview-to-book": "Book the interview",
  "interview-booked": "Interviewed · offer decision",
  "no-offer": "No offer",
  offered: "Offer sent · waiting for answer",
  hired: "Offer accepted",
  "offer-declined": "Offer declined",
};
