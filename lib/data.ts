/** All data in this prototype is synthetic. Company names and people are fictional. */

// Personas live in data/seed/*.json and are validated by the seed loader.
export { COMPANIES, SEED_NEEDS, SEED_TALENT } from "./seed";

export const EVENT = {
  name: "Espoo Green & Digital Matchmaking",
  date: "Thu 3 Dec 2026",
  isoDate: "2026-12-03",
  time: "10:00–12:00",
  place: "Hybrid · Otaniemi + online",
  weeksAway: 3,
  slotMinutes: 10,
};

export const SLOTS = [
  "10:00",
  "10:10",
  "10:20",
  "10:30",
  "10:40",
  "10:50",
  "11:00",
  "11:10",
  "11:20",
  "11:30",
  "11:40",
  "11:50",
];

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
