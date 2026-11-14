/** All data in this prototype is synthetic. Company names and people are fictional. */

// Personas live in the database (lib/seed-db.ts) and are validated by the seed loader.
export { COMPANIES, SEED_NEEDS, SEED_TALENT } from "./seed";

/**
 * When interviews happen: across a whole work week (Mon–Fri, office hours), in Espoo or
 * online, not on one event day. Slots are "YYYY-MM-DD HH:MM" (lib/schedule.ts). Change
 * `days` to move the interview week.
 */
export const EVENT = {
  name: "Espoo recruitment",
  date: "Mon 30 Nov – Fri 4 Dec 2026",
  isoDate: "2026-11-30",
  time: "Mon–Fri 9:00–16:00",
  start: "09:00",
  end: "16:00",
  place: "In Espoo or online",
  weeksAway: 2,
  slotMinutes: 30,
  days: ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"],
};

/**
 * The company the demo user describes in the intake chat (id C-YOU). Fictional, like every
 * other company here.
 */
export const OWN_COMPANY = {
  id: "C-YOU",
  name: "Tapiola Data Works",
  blurb: "Data and software consultancy in Espoo, 60 people",
};

/** Short written scenario prompts for the talent skill card. Plain language, no CV. */
export const SCENARIO_PROMPTS = [
  {
    id: "p1",
    kind: "scenario" as const,
    prompt:
      "Describe a time something broke or went wrong at work, in your studies or at home. What did you check first, and why?",
    hint: "Concrete steps beat polished words. 3–6 sentences is plenty.",
  },
  {
    id: "p2",
    kind: "scenario" as const,
    prompt: "Tell us about something you had to learn quickly. How did you go about it?",
    hint: "A tool, a process, a language, a new team: anything counts.",
  },
  {
    id: "p3",
    kind: "scenario" as const,
    prompt: "Describe a misunderstanding with a colleague, customer or patient. What did you do?",
    hint: "What you said or did matters more than how it ended.",
  },
  {
    id: "p4",
    kind: "sample" as const,
    prompt: "Describe one thing you made or improved: a script, a plan, a schedule, a design, a process.",
    hint: "Something you'd be happy to talk through for five minutes.",
  },
];

/** Optional voice-note prompt (talent Evidence step). */
export const VOICE_PROMPT = "60-second voice note: explain something from your field to a 12-year-old.";
