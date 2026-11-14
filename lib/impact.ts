import { rulesPrivacy } from "./talent-ai";
import type { Feedback, FeedbackSide, NextStep, SideFeedback } from "./types";

/**
 * Feedback loop: structured post-meeting answers from both sides, turned into impact
 * metrics for the organiser. Ratings are about the meeting and the cards, never the person.
 */

export const NEXT_STEPS: Record<FeedbackSide, { value: NextStep; label: string }[]> = {
  company: [
    { value: "continue", label: "Invite to an interview" },
    { value: "keep-in-touch", label: "Keep in touch" },
    { value: "stop", label: "Not a fit right now" },
  ],
  talent: [
    { value: "continue", label: "I'd like to continue" },
    { value: "keep-in-touch", label: "Keep in touch" },
    { value: "stop", label: "Not for me" },
  ],
};

export const QUESTIONS: Record<FeedbackSide, { accuracy: string; usefulness: string }> = {
  company: {
    accuracy: "Did the skill card match what you heard in the meeting?",
    usefulness: "Was the meeting worth your 10 minutes?",
  },
  talent: {
    accuracy: "Did the role match what the need card said?",
    usefulness: "Was the meeting worth your 10 minutes?",
  },
};

/** What's still missing before one side's feedback can be sent. */
export function feedbackError(f: Partial<SideFeedback>): string | null {
  if (f.held === undefined) return "Say whether the meeting happened.";
  if (!f.held) return null;
  if (!f.usefulness) return "Rate whether the meeting was worth the time.";
  if (!f.accuracy) return "Rate how well the card matched.";
  if (!f.nextStep) return "Pick the next step.";
  return null;
}

export type PairOutcome = "awaiting" | "no-show" | "interview" | "follow-up" | "no-follow-up";

/** Outcome of one meeting from both sides' answers. Follow-ups need interest from both. */
export function pairOutcome(f: Feedback | undefined): PairOutcome {
  const c = f?.company;
  const t = f?.talent;
  if (!c && !t) return "awaiting";
  if (!c?.held && !t?.held) return "no-show"; // everyone who answered says it didn't happen
  if (!c?.held || !t?.held) return "awaiting"; // one side still to answer (or answers disagree)
  if (c.nextStep === "stop" || t.nextStep === "stop") return "no-follow-up";
  if (c.nextStep === "continue" && t.nextStep === "continue") return "interview";
  return "follow-up";
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Remove names, contacts, origin, schools and similar from free text before organisers see it. */
export const anonymise = (text: string) =>
  rulesPrivacy([{ id: "x", text }])
    .reduce((t, f) => t.split(f.text).join("[removed]"), text)
    .trim();

export type Impact = ReturnType<typeof impactMetrics>;

/** Impact for the organiser dashboard, from booked slots and both sides' feedback. */
export function impactMetrics(slots: Record<string, string>, feedback: Record<string, Feedback>) {
  const booked = Object.keys(slots);
  const answered = booked.filter((k) => feedback[k]?.company || feedback[k]?.talent);
  const held = booked.filter((k) => feedback[k]?.company?.held || feedback[k]?.talent?.held);
  const outcomes = booked.map((k) => pairOutcome(feedback[k]));
  const sides = held.flatMap((k) =>
    (["company", "talent"] as const).flatMap((side) => {
      const f = feedback[k]?.[side];
      return f?.held ? [{ side, f }] : [];
    }),
  );
  const of = (side: FeedbackSide) => sides.filter((s) => s.side === side).map((s) => s.f);

  return {
    booked: booked.length,
    answered: answered.length,
    held: held.length,
    noShows: outcomes.filter((o) => o === "no-show").length,
    interviews: outcomes.filter((o) => o === "interview").length,
    followUps: outcomes.filter((o) => o === "interview" || o === "follow-up").length,
    /** Share of held meetings where both sides answered. */
    responseRate: held.length
      ? held.filter((k) => feedback[k]?.company && feedback[k]?.talent).length / held.length
      : null,
    satisfaction: {
      company: avg(of("company").flatMap((f) => (f.usefulness ? [f.usefulness] : []))),
      talent: avg(of("talent").flatMap((f) => (f.usefulness ? [f.usefulness] : []))),
    },
    /** Did skill cards match the person (company view) and need cards match the role (candidate view)? */
    accuracy: {
      skillCards: avg(of("company").flatMap((f) => (f.accuracy ? [f.accuracy] : []))),
      needCards: avg(of("talent").flatMap((f) => (f.accuracy ? [f.accuracy] : []))),
    },
    ideas: sides
      .filter((s) => s.f.improve?.trim())
      .map((s) => ({ side: s.side, text: anonymise(s.f.improve!) }))
      .slice(0, 6),
  };
}
