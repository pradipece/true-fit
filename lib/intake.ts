import {
  normalize,
  extractSkills,
  OCCUPATION_BY_ID,
  OCCUPATIONS,
  searchOccupations,
  SKILL_BY_ID,
  SKILLS,
  skillLabel,
} from "./esco";
import type { Engagement, Need } from "./types";

/**
 * Company intake: shared between the API route (Gemini) and the browser (offline rules).
 *
 * The assistant only structures what the company says into a need card. It never sees
 * talent data, and nothing reaches the organiser until a person approves the card.
 */

export const LANGUAGES: Need["language"][] = ["English OK", "Finnish or English", "Finnish required"];
export const MODES: Need["mode"][] = ["On-site", "Hybrid", "Remote"];
export const ENGAGEMENTS: Engagement[] = ["Permanent", "Fixed-term", "Part-time", "Internship / trainee"];

/** Work-in-progress need card. Empty string = not decided yet. */
export type NeedDraft = {
  title: string;
  occupation: string;
  summary: string;
  must: string[];
  nice: string[];
  language: Need["language"] | "";
  mode: Need["mode"] | "";
  timing: { start: string; engagement: Engagement | "" };
};

export const EMPTY_DRAFT: NeedDraft = {
  title: "",
  occupation: "",
  summary: "",
  must: [],
  nice: [],
  language: "",
  mode: "",
  timing: { start: "", engagement: "" },
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Topics the offline assistant has already asked about. */
export type Topic = "area" | "tasks" | "must" | "language" | "timing" | "mode";

export type IntakeRequest = { messages: ChatMessage[]; draft: NeedDraft; asked: Topic[] };

export type IntakeTurn = {
  reply: string;
  quickReplies: string[];
  draft: NeedDraft;
  asked: Topic[];
  ready: boolean;
  source: "ai" | "rules";
};

// ── Draft helpers ────────────────────────────────────────────────────────────

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/** Drop unknown skill ids, duplicates and must/nice overlap; clamp enums. */
export function sanitizeDraft(d: Partial<NeedDraft>): NeedDraft {
  const must = uniq((d.must ?? []).filter((s) => SKILL_BY_ID[s]));
  const nice = uniq((d.nice ?? []).filter((s) => SKILL_BY_ID[s] && !must.includes(s)));
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | "" =>
    allowed.includes(v as T) ? (v as T) : "";
  return {
    title: (d.title ?? "").trim().slice(0, 80),
    occupation: d.occupation && OCCUPATION_BY_ID[d.occupation] ? d.occupation : "",
    summary: (d.summary ?? "").trim().slice(0, 400),
    must,
    nice,
    language: oneOf(d.language, LANGUAGES),
    mode: oneOf(d.mode, MODES),
    timing: {
      start: (d.timing?.start ?? "").trim().slice(0, 40),
      engagement: oneOf(d.timing?.engagement, ENGAGEMENTS),
    },
  };
}

export type MissingField = "role" | "must-have skills" | "language" | "timing" | "way of working";

export function missingFields(d: NeedDraft): MissingField[] {
  const out: MissingField[] = [];
  if (!d.title) out.push("role");
  if (!d.must.length) out.push("must-have skills");
  if (!d.language) out.push("language");
  if (!d.timing.start) out.push("timing");
  if (!d.mode) out.push("way of working");
  return out;
}

/** The draft as a Need, for live pool counts and for submitting once approved. */
export function draftToNeed(d: NeedDraft, company: string): Need {
  return {
    id: "N-YOU",
    company: company.trim() || "Your company",
    companyBlurb: "Submitted through the intake chat",
    title: d.title || "New role",
    occupation: d.occupation || undefined,
    summary: d.summary,
    must: d.must,
    nice: d.nice,
    language: d.language || "English OK",
    mode: d.mode || "Hybrid",
    timing: d.timing.start
      ? { start: d.timing.start, engagement: d.timing.engagement || "Permanent" }
      : undefined,
    submittedWeeksBefore: 0,
    createdByUser: true,
  };
}

/** Occupation whose typical skills overlap most with the draft (≥ 2 shared). */
function bestOccupation(skills: string[]) {
  let best: { id: string; overlap: number } | null = null;
  for (const o of OCCUPATIONS) {
    const overlap = o.skills.filter((s) => skills.includes(s)).length;
    if (overlap >= 2 && (!best || overlap > best.overlap)) best = { id: o.id, overlap };
  }
  return best ? OCCUPATION_BY_ID[best.id] : undefined;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── LLM: prompt and output schema ─────────────────────────────────────────

const SKILL_IDS = SKILLS.map((s) => s.id);
const OCCUPATION_IDS = OCCUPATIONS.map((o) => o.id);

export const INTAKE_SYSTEM_PROMPT = `You are the intake assistant for a recruitment matchmaking event run by the City of Espoo, Finland. A company representative describes a role, often vaguely ("we need a dev"). Turn that into a precise need card through a short conversation.

How to run the conversation:
- Ask one clarifying question per turn, in plain language, at most two sentences plus the question. Aim to finish in 4–6 turns.
- Cover, in roughly this order: what kind of role and the actual work in the first three months; which skills are truly must-have versus nice-to-have; working language; start date and type of contract; on-site, hybrid or remote.
- Offer 2–4 short quick replies the user can tap (under 40 characters each). Leave them empty only when the card is ready.
- Gently challenge requirements that shrink the pool without serving the work. If Finnish isn't needed from day one, suggest "Finnish or English". Keep must-haves to 2–3 skills. Do not add degree, nationality, age, gender, accent or "native speaker" requirements; if the user asks for one, explain briefly that matching uses skills only and steer back to the skill behind it.
- Never invent candidates or mention specific people. You do not see the talent pool.

How to fill the draft:
- Use only skill ids from the skill catalogue below. Map the user's words to the closest skill. Put a skill in "must" only when the user says it is essential or clearly implies it; otherwise use "nice".
- "occupation" is the closest ESCO occupation id from the catalogue, or "" if none fits. "title" is a short, human job title.
- "summary" is one or two sentences describing the work, in the user's terms.
- Leave a field as "" (or []) when it hasn't been discussed. Do not guess language, timing or way of working.
- The user may edit the card directly. The <current_need_card> in their latest message is authoritative: keep their edits unless they ask for a change in the chat.
- Set "ready" to true only when title, at least one must-have, language, timing.start and mode are all filled. When ready, tell them to review and approve the card; nothing is sent to the organiser until they do.

Reply in the language the user writes in (English, Finnish or Swedish), but keep skill ids and enum values exactly as specified.

Skill catalogue (id: label — ESCO preferred label):
${SKILLS.map((s) => `${s.id}: ${s.label} — ${s.escoLabel}`).join("\n")}

Occupation catalogue (id: ESCO label):
${OCCUPATIONS.map((o) => `${o.id}: ${o.label}`).join("\n")}`;

const str = (description: string) => ({ type: "string", description });
const skillList = (description: string) => ({
  type: "array",
  description,
  items: { type: "string", enum: SKILL_IDS },
});

/** JSON schema for the model's structured output. Enums keep it inside the cached ESCO subset. */
export const INTAKE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "quick_replies", "draft", "ready"],
  properties: {
    reply: str("Your chat message to the company: brief context plus one clarifying question."),
    quick_replies: { type: "array", description: "2–4 tappable answers.", items: { type: "string" } },
    ready: { type: "boolean", description: "True only when every required field is filled." },
    draft: {
      type: "object",
      additionalProperties: false,
      required: ["title", "occupation", "summary", "must", "nice", "language", "mode", "timing"],
      properties: {
        title: str("Short job title, or empty."),
        occupation: { type: "string", enum: ["", ...OCCUPATION_IDS] },
        summary: str("One or two sentences on the work."),
        must: skillList("Essential skills. Keep to 2–3."),
        nice: skillList("Helpful but not essential skills."),
        language: { type: "string", enum: ["", ...LANGUAGES] },
        mode: { type: "string", enum: ["", ...MODES] },
        timing: {
          type: "object",
          additionalProperties: false,
          required: ["start", "engagement"],
          properties: {
            start: str('When the person should start, e.g. "ASAP", "February 2027", or empty.'),
            engagement: { type: "string", enum: ["", ...ENGAGEMENTS] },
          },
        },
      },
    },
  },
} as const;

/** The latest user message with the current card attached, so direct edits win. */
export function withCurrentCard(text: string, draft: NeedDraft) {
  return `${text}\n\n<current_need_card>\n${JSON.stringify(draft, null, 2)}\n</current_need_card>`;
}

// ── Offline rules: a deterministic stand-in when no model is available ──────

const DEV_WORDS =
  /\b(dev|devs|developer|developers|coder|programmer|engineer|koodari|kehittaja|ohjelmoija)\b/;

const QUICK = {
  dev: ["Web front-end (React)", "Back-end & APIs", "Data & pipelines (Python, SQL)", "Embedded / firmware"],
  area: [
    "Data analysis & dashboards",
    "Logistics & warehouse",
    "Patient or elderly care",
    "Energy efficiency & HVAC",
  ],
  language: ["English is fine", "Finnish or English", "Finnish required from day one"],
  timing: ["ASAP, permanent", "Spring 2027, permanent", "Fixed-term, 6 months", "Summer trainee 2027"],
  mode: MODES.map((m) => m as string),
};

function parseLanguage(t: string): Need["language"] | "" {
  if (/finnish (is )?(required|needed|must)|must speak finnish|fluent finnish|suomi pakollinen/.test(t))
    return "Finnish required";
  if (/finnish or english|either/.test(t)) return "Finnish or English";
  if (/english (is )?(ok|fine|enough)|english only|in english|^english/.test(t)) return "English OK";
  return "";
}

function parseMode(t: string): Need["mode"] | "" {
  if (/hybrid/.test(t)) return "Hybrid";
  if (/remote|etatyo/.test(t)) return "Remote";
  if (/on-?site|in the office|at the office|lahityo/.test(t)) return "On-site";
  return "";
}

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec";
const START_RE = new RegExp(
  `\\b(asap|as soon as possible|immediately|now|(?:early |late )?(?:spring|summer|autumn|fall|winter)(?: \\d{4})?|q[1-4](?: \\d{4})?|(?:${MONTHS})(?: \\d{4})?|within \\d+ (?:weeks|months))\\b`,
);

function parseTiming(t: string): { start: string; engagement: Engagement | "" } {
  const m = t.match(START_RE);
  let start = m ? m[1] : "";
  if (/^(asap|as soon as possible|immediately|now)$/.test(start)) start = "ASAP";
  else if (start) start = start.replace(/\b\w/g, (c) => c.toUpperCase());
  const engagement: Engagement | "" = /trainee|intern|harjoittel/.test(t)
    ? "Internship / trainee"
    : /fixed|temporary|month contract|maaraaikai/.test(t)
      ? "Fixed-term"
      : /part-?time|osa-aika/.test(t)
        ? "Part-time"
        : /permanent|vakituinen|full-?time/.test(t)
          ? "Permanent"
          : "";
  if (!start && engagement === "Fixed-term") start = "ASAP";
  return { start, engagement };
}

/** Prefer job-specific skills over transversal ones when proposing must-haves. */
const mustPriority = (id: string) => (SKILL_BY_ID[id]?.group === "Transversal" ? 1 : 0);

export function rulesTurn({
  messages,
  draft: input,
  asked: askedIn,
}: IntakeRequest): Omit<IntakeTurn, "source"> {
  const draft = sanitizeDraft(input);
  const asked = new Set(askedIn);
  const raw = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const t = normalize(raw);
  const last = askedIn[askedIn.length - 1];

  // 1. Apply what the user just said.
  // Answers about language, timing or way of working aren't about skills ("fixed-term" ≠ "fix").
  const practical = last === "language" || last === "timing" || last === "mode";
  const mentioned = practical ? [] : extractSkills(raw);
  const found = mentioned.filter((s) => !draft.must.includes(s) && !draft.nice.includes(s));
  if (last === "must" && mentioned.length) {
    draft.must = uniq([...draft.must, ...mentioned]);
    draft.nice = draft.nice.filter((s) => !draft.must.includes(s));
  } else {
    draft.nice = uniq([...draft.nice, ...found]);
  }
  // Summary: the first message, replaced by the concrete tasks once we have them.
  if (!askedIn.length) draft.summary = raw.slice(0, 400);
  if (last === "tasks") draft.summary = raw.slice(0, 400);

  const occHit = searchOccupations(raw, 1)[0];
  const occ = occHit && occHit.score >= 60 ? occHit.item : bestOccupation([...draft.must, ...draft.nice]);
  if (occ && !draft.occupation) {
    draft.occupation = occ.id;
    occ.skills.slice(0, 2).forEach((s) => {
      if (!draft.must.includes(s) && !draft.nice.includes(s)) draft.nice.push(s);
    });
  }
  if (!draft.title && occ) draft.title = capitalise(occ.label);

  const lang = parseLanguage(t);
  if (lang && (last === "language" || !draft.language)) draft.language = lang;
  const mode = parseMode(t);
  if (mode && (last === "mode" || !draft.mode)) draft.mode = mode;
  // Dates and contract words are ambiguous in free text ("may", "fixed"), so only read
  // them when we asked about timing, or when the user plainly says "ASAP".
  if (last === "timing" || /\b(asap|as soon as possible)\b/.test(t)) {
    const timing = parseTiming(t);
    if (timing.start) draft.timing.start = timing.start;
    if (timing.engagement) draft.timing.engagement = timing.engagement;
    if (draft.timing.start && !draft.timing.engagement) draft.timing.engagement = "Permanent";
  }

  const skills = [...draft.must, ...draft.nice];
  const picked = found.length ? `I mapped that to ${found.map(skillLabel).join(", ")}. ` : "";

  const ask = (topic: Topic, reply: string, quickReplies: string[]): Omit<IntakeTurn, "source"> => ({
    reply,
    quickReplies,
    draft,
    asked: [...askedIn, topic],
    ready: false,
  });

  // 2. Ask about the most important thing still open.
  if (!skills.length) {
    if (asked.has("area"))
      return ask(
        "tasks",
        "Let's come at it from the work itself: what would this person do on a normal Tuesday?",
        [],
      );
    return DEV_WORDS.test(t)
      ? ask(
          "area",
          "Happy to help. “Dev” covers a lot of ground: what kind of software would they work on?",
          QUICK.dev,
        )
      : ask("area", "Got it. Which area is the role in? Rough is fine.", QUICK.area);
  }

  if (!asked.has("tasks"))
    return ask(
      "tasks",
      `${picked}What will this person actually do in their first three months? Concrete tasks help me pick the right skills.`,
      [],
    );

  if (!asked.has("must")) {
    if (!draft.must.length) {
      const proposal = [...skills].sort((a, b) => mustPriority(a) - mustPriority(b)).slice(0, 3);
      draft.must = proposal;
      draft.nice = draft.nice.filter((s) => !proposal.includes(s));
    }
    return ask(
      "must",
      `${picked}I've marked ${draft.must.map(skillLabel).join(", ")} as must-haves and the rest as nice-to-have. Every extra must-have shrinks the pool, so 2–3 is usually right. Does that look right? You can also tap skills on the card.`,
      ["Looks right", ...draft.nice.slice(0, 2).map((s) => `${skillLabel(s)} is also a must`)],
    );
  }

  if (!draft.language)
    return ask(
      "language",
      "Which working language does the job need? If Finnish can be learned on the job, “Finnish or English” keeps far more people in the pool.",
      QUICK.language,
    );

  if (!draft.timing.start)
    return ask("timing", "When should they start, and on what kind of contract?", QUICK.timing);

  if (!draft.mode) return ask("mode", "Last one: how will they work?", QUICK.mode);

  if (!draft.title) draft.title = `${skillLabel(draft.must[0] ?? skills[0])} specialist`;

  return {
    reply:
      "That's everything I need. Review the need card, edit anything that's off, and approve it when you're happy. Nothing goes to the organiser until you do.",
    quickReplies: [],
    draft,
    asked: askedIn,
    ready: true,
  };
}
