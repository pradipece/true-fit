/** All data in this prototype is synthetic. Company names and people are fictional. */

// Personas live in data/seed/*.json and are validated by the seed loader.
export { COMPANIES, SEED_NEEDS, SEED_TALENT } from "./seed";

export const EVENT = {
  name: "Espoo Green & Digital Matchmaking",
  date: "Thu 3 Dec 2026",
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

export const SCENARIO_PROMPTS = [
  {
    id: "p1",
    kind: "scenario" as const,
    prompt: "Describe a time something broke or went wrong at work. What did you check first, and why?",
    hint: "Concrete steps beat polished words. 3–6 sentences is plenty.",
  },
  {
    id: "p2",
    kind: "voice" as const,
    prompt: "60-second voice note: explain something from your field to a 12-year-old.",
    hint: "In the prototype, type a transcript. Audio would be transcribed and deleted after 30 days.",
  },
  {
    id: "p3",
    kind: "sample" as const,
    prompt:
      "Small work sample: describe or link one thing you made (a script, a plan, a schedule, a design).",
    hint: "Something you'd be happy to talk through for five minutes.",
  },
];
