import {
  normalize,
  extractSkills,
  OCCUPATION_BY_ID,
  OCCUPATIONS,
  relatedSkills,
  searchOccupations,
  SKILL_BY_ID,
  SKILLS,
  skillLabel,
} from "./esco";
import { matchesForNeed } from "./match";
import { openToMode, speaksRequired } from "./need-terms";
import type { Engagement, Need, Talent } from "./types";

/**
 * Company intake: shared between the API route (Gemini) and the browser (offline rules).
 *
 * The assistant only structures what the company says into a need card. It never sees
 * talent data, and no candidate is suggested until a person approves the card.
 */

/** Presets offered as one-tap choices. The fields themselves are free text. */
export const LANGUAGES = ["English OK", "Finnish or English", "Finnish required"];
export const MODES = ["On-site", "Hybrid", "Remote"];
export const ENGAGEMENTS: string[] = ["Permanent", "Fixed-term", "Part-time", "Internship / trainee"];

/** Work-in-progress need card. Empty string = not decided yet. */
export type NeedDraft = {
  title: string;
  occupation: string;
  summary: string;
  must: string[];
  nice: string[];
  /** Free text; "" = not decided yet. */
  language: string;
  /** Free text; "" = not decided yet. */
  mode: string;
  timing: { start: string; engagement: string };
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
  /** Set when the role changed this turn and the card was rechecked against the pool. */
  recheck?: RoleRecheck;
};

// ── Draft helpers ────────────────────────────────────────────────────────────

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/** Drop unknown skill ids, duplicates and must/nice overlap; clamp enums. */
/** Longest free-text value for language, way of working and contract type. */
export const FREE_TEXT_MAX = 60;

export function sanitizeDraft(d: Partial<NeedDraft>): NeedDraft {
  const must = uniq((d.must ?? []).filter((s) => SKILL_BY_ID[s]));
  const nice = uniq((d.nice ?? []).filter((s) => SKILL_BY_ID[s] && !must.includes(s)));
  // Free-text fields: any wording is allowed, kept short and on one line.
  const text = (v: unknown, max = FREE_TEXT_MAX) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
  return {
    title: (d.title ?? "").trim().slice(0, 80),
    occupation: d.occupation && OCCUPATION_BY_ID[d.occupation] ? d.occupation : "",
    summary: (d.summary ?? "").trim().slice(0, 400),
    must,
    nice,
    language: text(d.language),
    mode: text(d.mode),
    timing: {
      start: text(d.timing?.start, 40),
      engagement: text(d.timing?.engagement),
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
    companyId: "C-YOU",
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

export const INTAKE_SYSTEM_PROMPT = `You are TrueFit Assistant, the intake assistant for a recruitment matchmaking event run by the City of Espoo, Finland. A company representative describes a role, often vaguely ("we need a dev"). Turn that into a precise need card through a short conversation.

How to run the conversation:
- Ask one clarifying question per turn, in plain language, at most two sentences plus the question. Aim to finish in 4–6 turns.
- Cover, in roughly this order: what kind of role and which skills would suit candidates for it (ask "What skills would suit candidates for this role?", not about the first months' tasks); which skills are truly must-have versus nice-to-have; working language; start date and type of contract; on-site, hybrid or remote.
- Offer 2–4 suggested answers ("quick_replies") the user can tap instead of typing. Rules for them:
  - Each one is a complete answer to the exact question in your reply, written as the user would say it (first person, "we"/"our"), in the language the user writes in. Never a question, never a bare "Yes"/"No", never advice to the user.
  - Tailor them to this conversation: reuse the role, domain, tools and constraints the user already mentioned ("Python and SQL are must-haves, React is a bonus" rather than "Data skills"). Don't repeat something already settled on the card.
  - Make them genuinely different options, ordered from most likely to least, and keep one flexible or uncertain option when it fits ("Not sure yet, English is fine to start").
  - Use the <pool_summary> (aggregate counts of who is registered) to favour options the pool can actually fill: areas and skills many people have, start dates people are available by and, when discussing must-haves, moving a rare skill to nice-to-have. Name skills by their labels.
  - Keep each under 60 characters. Leave the list empty only when the card is ready.
- You may cite pool numbers from <pool_summary> in your reply ("6 people at this event work with Python"). They are counts only; never imply you know who those people are.
- Gently challenge requirements that shrink the pool without serving the work. If Finnish isn't needed from day one, suggest "Finnish or English". Keep must-haves to 2–3 skills. Do not add degree, nationality, age, gender, accent or "native speaker" requirements; if the user asks for one, explain briefly that matching uses skills only and steer back to the skill behind it.
- Never invent candidates or mention specific people. You do not see the talent pool.

How to fill the draft:
- Use only skill ids from the skill catalogue below. Map the user's words to the closest skill. Put a skill in "must" only when the user says it is essential or clearly implies it; otherwise use "nice".
- "occupation" is the closest ESCO occupation id from the catalogue, or "" if none fits. "title" is a short, human job title.
- "summary" is one or two sentences describing the work, in the user's terms.
- You have full access to the whole card and may change any field, including values you or the user set earlier, whenever the conversation calls for it (for example the user changes their mind, or a later answer refines an earlier one). Say briefly in your reply what you changed.
- "language", "mode" and "timing.engagement" are free text. Use the standard wording when it fits (language: ${LANGUAGES.join(" / ")}; mode: ${MODES.join(" / ")}; contract: ${ENGAGEMENTS.join(" / ")}). When the user describes something else, write it in their words, short and clear: "Swedish or English", "Finnish within a year, English to start", "On-site 3 days, 2 remote", "6-month project". Never write a "native speaker" or mother-tongue requirement; use a working level instead.
- Skills are the exception: "must" and "nice" accept only ids from the skill catalogue, because matching runs on that list. If the user names a skill that isn't in it, map it to the closest catalogue skill and mention it in the summary.
- Leave a field as "" (or []) when it hasn't been discussed. Do not guess language, timing or way of working.
- When the user changes the role itself (a different job, not a refinement of the same one), rebuild the card for the new role instead of patching the old one: set the new title, occupation and summary, replace must-have and nice-to-have skills that belonged to the old role (keep one only if the user says so or it clearly fits the new work), and keep language, timing and way of working only if they still apply, otherwise clear them and ask again. Say in one sentence what you changed. Then use <current_card_pool> and <pool_summary> to tell them roughly how many people at this event have the new must-haves.
- The user may edit the card directly. The <current_need_card> in their latest message is authoritative: keep their edits unless they ask for a change in the chat.
- Set "ready" to true only when title, at least one must-have, language, timing.start and mode are all filled. When ready, tell them to review and approve the card; no candidates are suggested until they do.

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
    quick_replies: {
      type: "array",
      description:
        "2–4 suggested answers to your question, in the user's voice and language, tailored to what they said. Under 60 characters each.",
      items: { type: "string" },
    },
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
        language: str(
          `Working language in plain words. Use a preset when it fits (${LANGUAGES.join(", ")}), otherwise the user's own wording, e.g. "Swedish or English". Empty if not discussed.`,
        ),
        mode: str(
          `Way of working in plain words. Use a preset when it fits (${MODES.join(", ")}), otherwise the user's own wording, e.g. "On-site 4 days, 1 remote". Empty if not discussed.`,
        ),
        timing: {
          type: "object",
          additionalProperties: false,
          required: ["start", "engagement"],
          properties: {
            start: str('When the person should start, e.g. "ASAP", "February 2027", or empty.'),
            engagement: str(
              `Contract type in plain words. Use a preset when it fits (${ENGAGEMENTS.join(", ")}), otherwise the user's wording, e.g. "6-month project". Empty if not discussed.`,
            ),
          },
        },
      },
    },
  },
} as const;

export const QUICK_REPLY_MAX = 60;

/**
 * Clean the model's suggested answers before they reach the chat: trimmed, unquoted,
 * short, no duplicates, nothing that just repeats what the user last said. At most 4.
 */
export function cleanQuickReplies(list: unknown, lastUserText = ""): string[] {
  if (!Array.isArray(list)) return [];
  const norm = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const last = norm(lastUserText);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const text = item
      .trim()
      .replace(/^["“'«]+|["”'»]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = norm(text);
    if (!key || text.length > QUICK_REPLY_MAX || key === last || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length === 4) break;
  }
  return out;
}

/** Fixed opening suggestions, used until (or instead of) the tailored ones. */
export const DEFAULT_STARTERS = ["We need a dev", "Someone to sort out our data", "A nurse for home care"];

export const STARTERS_SYSTEM_PROMPT = `You write opening suggestions for a company intake chat at a City of Espoo recruitment matchmaking event. The assistant has just asked the company: "Who would you like to meet there? Describe it in your own words."

Write 3 short answers a company representative might tap, in English, in their voice ("We need…", "Someone who…"). Keep them casual and a bit vague, like real first messages. Base them on the <pool_summary> (aggregate counts of who is registered): pick three different areas where many registered people have skills, so the company is likely to find a match. Each under ${QUICK_REPLY_MAX} characters. Never mention specific people or numbers.`;

export const STARTERS_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["starters"],
  properties: {
    starters: { type: "array", description: "Three opening messages.", items: { type: "string" } },
  },
} as const;

/** The latest user message with the current card attached, so direct edits win. */
export function withCurrentCard(
  text: string,
  draft: NeedDraft,
  pool?: ReturnType<typeof poolSummary>,
  card?: CardPoolCheck,
) {
  const summary = pool ? `\n\n<pool_summary>\n${JSON.stringify(pool)}\n</pool_summary>` : "";
  const counts = card ? `\n\n<current_card_pool>\n${JSON.stringify(card)}\n</current_card_pool>` : "";
  return `${text}\n\n<current_need_card>\n${JSON.stringify(draft, null, 2)}\n</current_need_card>${summary}${counts}`;
}

// ── Offline rules: a deterministic stand-in when no model is available ──────

const DEV_WORDS =
  /\b(dev|devs|developer|developers|coder|programmer|engineer|koodari|kehittaja|ohjelmoija)\b/;

// ── Pool-aware suggestions ───────────────────────────────────────────────────
// Quick replies come from the conversation and from aggregate pool data (counts only,
// never individuals), so the company sees what the pool can actually fill.

const DEV_AREAS = [
  { text: "Data & pipelines (Python, SQL)", skills: ["pipelines", "python", "sql"] },
  { text: "Web front-end (React)", skills: ["js", "react"] },
  { text: "Back-end & APIs", skills: ["backend"] },
  { text: "Testing & QA", skills: ["testing"] },
  { text: "Cloud & security", skills: ["cloud", "security"] },
  { text: "Embedded / firmware", skills: ["embedded"] },
];

const AREAS = [
  { text: "Data analysis & dashboards", skills: ["analysis", "sql"] },
  { text: "Logistics & warehouse", skills: ["logistics", "warehouse", "supply"] },
  { text: "Patient or elderly care", skills: ["patient-care", "elderly-care"] },
  { text: "Energy efficiency & HVAC", skills: ["energy", "hvac"] },
  { text: "Software (back-end, front-end)", skills: ["backend", "js", "python"] },
  { text: "Customer service & sales", skills: ["customer", "sales"] },
  { text: "Project coordination", skills: ["pm"] },
  { text: "Sustainability & ESG", skills: ["esg", "circular"] },
];

const hasAny = (t: Talent, skills: string[]) => t.skills.some((s) => skills.includes(s.id));

/** People in the pool who list at least one of the skills. */
export const poolCount = (skills: string[], pool: Talent[]) => pool.filter((t) => hasAny(t, skills)).length;

/** Same rule as the Candidates page suggestions: people at or above the overlap guide. */
export const relevantCount = (d: NeedDraft, pool: Talent[]) =>
  d.must.length ? matchesForNeed(draftToNeed(d, ""), pool).filter((m) => m.suggested).length : 0;

/** Skills named in free text: intake keyword hints plus plain skill labels. */
export function mentionedSkills(text: string) {
  const n = normalize(text);
  return uniq([
    ...extractSkills(text),
    ...SKILLS.filter((s) => n.includes(normalize(s.label))).map((s) => s.id),
  ]);
}

/** People who can work in the required language(s). Works for presets and free text. */
export function languageCount(req: string, pool: Talent[]) {
  return pool.filter((t) => speaksRequired(req, t)).length;
}

const modeCount = (mode: string, pool: Talent[]) => pool.filter((t) => openToMode(mode, t)).length;

const MONTH_INDEX: [string, number][] = [
  ["asap", 0],
  ["immediately", 0],
  ["now", 0],
  ["january", 1],
  ["february", 2],
  ["march", 3],
  ["april", 4],
  ["may", 5],
  ["june", 6],
  ["july", 7],
  ["august", 8],
  ["september", 9],
  ["october", 10],
  ["november", 11],
  ["december", 12],
  ["spring", 3],
  ["summer", 6],
  ["autumn", 9],
  ["fall", 9],
  ["winter", 12],
];
const monthOf = (s: string) => MONTH_INDEX.find(([k]) => normalize(s).includes(k))?.[1];

/** People whose stated availability is on or before the start (demo: months of the coming year). */
export function availableBy(start: string, pool: Talent[]) {
  const by = monthOf(start);
  if (by === undefined) return undefined;
  return pool.filter((t) => (monthOf(t.availability) ?? 99) <= by).length;
}

const MONTH_NAME = ["", "January", "February", "March", "April", "May", "June"];

function areaOptions(dev: boolean, pool: Talent[]) {
  return (dev ? DEV_AREAS : AREAS)
    .map((a) => ({ text: a.text, n: poolCount(a.skills, pool) }))
    .filter((a) => a.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((a) => a.text);
}

/** Related skills the card doesn't have yet, that people in the pool do have. */
function relatedOptions(d: NeedDraft, pool: Talent[]) {
  const on = new Set([...d.must, ...d.nice]);
  const weight = new Map<string, number>();
  for (const id of on)
    for (const r of relatedSkills(id, 0.3))
      if (!on.has(r.skill.id)) weight.set(r.skill.id, (weight.get(r.skill.id) ?? 0) + r.weight);
  return [...weight]
    .map(([id, w]) => ({ id, w, n: poolCount([id], pool) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.w - a.w || b.n - a.n)
    .slice(0, 3)
    .map((x) => `Also ${skillLabel(x.id)}`);
}

function mustOptions(d: NeedDraft, pool: Talent[]) {
  const base = relevantCount(d, pool);
  const opts = ["Looks right"];
  if (d.must.length > 1) {
    const drop = d.must
      .map((id) => ({
        id,
        n: relevantCount({ ...d, must: d.must.filter((x) => x !== id), nice: [...d.nice, id] }, pool),
      }))
      .sort((a, b) => b.n - a.n)[0];
    if (drop.n > base) opts.push(`Make ${skillLabel(drop.id)} nice-to-have`);
  }
  d.nice
    .map((id) => ({
      id,
      n: relevantCount({ ...d, must: [...d.must, id], nice: d.nice.filter((x) => x !== id) }, pool),
    }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 2)
    .forEach((a) => opts.push(`${skillLabel(a.id)} is also a must`));
  return opts.slice(0, 4);
}

function timingOptions(pool: Talent[]) {
  const months = new Map<number, number>();
  for (const t of pool) {
    const m = monthOf(t.availability);
    if (m !== undefined) months.set(m, (months.get(m) ?? 0) + 1);
  }
  const opts: string[] = [];
  if (months.has(0)) opts.push("ASAP, permanent");
  [...months]
    .filter(([m]) => m > 0 && m < MONTH_NAME.length)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .sort((a, b) => a[0] - b[0])
    .forEach(([m]) => opts.push(`From ${MONTH_NAME[m]} 2027, permanent`));
  opts.push("Fixed-term, 6 months");
  return opts.slice(0, 4);
}

const modeOptions = (pool: Talent[]) => [...MODES].sort((a, b) => modeCount(b, pool) - modeCount(a, pool));

/**
 * A short data hint for a quick reply, e.g. "6 at this event" or "4 relevant (now 2)".
 * Computed in the browser for any reply, from Gemini or the rules.
 */
export function quickReplyHint(text: string, d: NeedDraft, pool: Talent[]): string | undefined {
  const t = normalize(text);
  if (!pool.length) return undefined;
  if (/^looks (right|good)/.test(t)) return `${relevantCount(d, pool)} relevant now`;

  const lang = parseLanguage(t);
  if (lang) return `${languageCount(lang, pool)} of ${pool.length} can work in it`;
  const mode = parseMode(t);
  if (mode && t.length <= 20) return `${modeCount(mode, pool)} open to ${mode.toLowerCase()}`;
  if (START_RE.test(t) || /trainee|fixed|permanent/.test(t)) {
    const n = availableBy(parseTiming(t).start, pool);
    if (n !== undefined) return `${n} available by then`;
  }

  const skills = mentionedSkills(text);
  if (!skills.length) return undefined;
  const base = relevantCount(d, pool);
  if (/also a must/.test(t)) {
    const n = relevantCount(
      { ...d, must: uniq([...d.must, ...skills]), nice: d.nice.filter((s) => !skills.includes(s)) },
      pool,
    );
    return `${n} relevant (now ${base})`;
  }
  if (/nice-to-have/.test(t)) {
    const must = d.must.filter((s) => !skills.includes(s));
    if (!must.length) return undefined;
    return `${relevantCount({ ...d, must, nice: uniq([...d.nice, ...skills]) }, pool)} relevant (now ${base})`;
  }
  return `${poolCount(skills, pool)} at this event`;
}

/** Aggregate pool numbers for the model. Counts only; nothing about any individual. */
export function poolSummary(pool: Talent[]) {
  const skills = SKILLS.map((s) => ({
    skill: s.id,
    people: pool.filter((t) => t.skills.some((x) => x.id === s.id)).length,
    evidenced: pool.filter((t) => t.skills.some((x) => x.id === s.id && x.level === "evidenced")).length,
  }))
    .filter((s) => s.people > 0)
    .sort((a, b) => b.people - a.people);
  const availability: Record<string, number> = {};
  for (const t of pool) availability[t.availability] = (availability[t.availability] ?? 0) + 1;
  return {
    people: pool.length,
    skills,
    workingLanguage: Object.fromEntries(LANGUAGES.map((l) => [l, languageCount(l, pool)])),
    openToMode: Object.fromEntries(MODES.map((m) => [m, modeCount(m, pool)])),
    availability,
  };
}

// ── Role changes: recheck the card against the pool ─────────────────────────

const titleWords = (s: string) =>
  new Set(
    normalize(s)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );

/**
 * True when the card moved to a different role, not a refinement of the same one
 * ("Developer" → "Back-end developer" is a refinement; "Developer" → "Nurse" is a change).
 */
export function roleChanged(prev: NeedDraft, next: NeedDraft): boolean {
  if (!prev.title && !prev.occupation) return false;
  if (prev.occupation && next.occupation) return prev.occupation !== next.occupation;
  const a = titleWords(prev.title);
  const b = titleWords(next.title);
  if (!a.size || !b.size) return false;
  return ![...a].some((w) => b.has(w));
}

/** Aggregate counts for one card. Numbers only, never who those people are. */
export type CardPoolCheck = {
  people: number;
  /** People at or above the overlap guide for the card's must-haves. */
  relevant: number;
  must: { skill: string; people: number }[];
  /** People who can work in the card's language; null when not set. */
  language: number | null;
  /** People open to the card's way of working; null when not set. */
  mode: number | null;
};

export function cardPoolCheck(d: NeedDraft, pool: Talent[]): CardPoolCheck {
  return {
    people: pool.length,
    relevant: relevantCount(d, pool),
    must: d.must.map((skill) => ({ skill, people: poolCount([skill], pool) })),
    language: d.language ? languageCount(d.language, pool) : null,
    mode: d.mode ? modeCount(d.mode, pool) : null,
  };
}

export type RoleRecheck = CardPoolCheck & {
  /** Skills from the old role that the server took off the card. */
  removed: string[];
};

/**
 * Safety net for role changes: skills carried over from the old card are dropped when
 * they don't fit the new occupation, aren't related to it, aren't transversal and the
 * user didn't name them in their latest message. Without a known occupation the card
 * is left as the model wrote it.
 */
export function dropStaleSkills(prev: NeedDraft, next: NeedDraft, userText: string) {
  const occ = next.occupation ? OCCUPATION_BY_ID[next.occupation] : undefined;
  if (!occ) return { draft: next, removed: [] as string[] };
  const fits = new Set(occ.skills);
  for (const s of occ.skills) for (const r of relatedSkills(s, 0.5)) fits.add(r.skill.id);
  const named = new Set(mentionedSkills(userText));
  const old = new Set([...prev.must, ...prev.nice]);
  const stale = (id: string) =>
    old.has(id) && !fits.has(id) && !named.has(id) && SKILL_BY_ID[id]?.group !== "Transversal";
  const removed = [...next.must, ...next.nice].filter(stale);
  if (!removed.length) return { draft: next, removed };
  return {
    draft: { ...next, must: next.must.filter((s) => !stale(s)), nice: next.nice.filter((s) => !stale(s)) },
    removed,
  };
}

/** One plain sentence with the new counts, appended to the reply after a role change. */
export function recheckNote(r: RoleRecheck): string {
  const parts: string[] = [];
  if (r.removed.length)
    parts.push(
      `I took ${r.removed.map(skillLabel).join(", ")} off the card, since they belonged to the earlier role.`,
    );
  if (r.must.length) {
    const per = r.must.map((m) => `${skillLabel(m.skill)} ${m.people}`).join(", ");
    parts.push(
      `Card rechecked for the new role: ${r.relevant} of ${r.people} people at this event fit the must-haves (people per skill: ${per}).`,
    );
  } else {
    parts.push(
      `Card rechecked for the new role: ${r.people} people are registered. Add a must-have skill to see how many fit.`,
    );
  }
  return parts.join(" ");
}

function parseLanguage(t: string): string {
  if (/finnish (is )?(required|needed|must)|must speak finnish|fluent finnish|suomi pakollinen/.test(t))
    return "Finnish required";
  if (/finnish or english|either/.test(t)) return "Finnish or English";
  if (/english (is )?(ok|fine|enough)|english only|in english|^english/.test(t)) return "English OK";
  return "";
}

function parseMode(t: string): string {
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

export function rulesTurn(
  { messages, draft: input, asked: askedIn }: IntakeRequest,
  pool: Talent[],
): Omit<IntakeTurn, "source"> {
  const draft = sanitizeDraft(input);
  const asked = new Set(askedIn);
  const raw = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const t = normalize(raw);
  const last = askedIn[askedIn.length - 1];

  // 1. Apply what the user just said.
  // Answers about language, timing or way of working aren't about skills ("fixed-term" ≠ "fix").
  const practical = last === "language" || last === "timing" || last === "mode";
  const mentioned = practical ? [] : mentionedSkills(raw);
  const found = mentioned.filter((s) => !draft.must.includes(s) && !draft.nice.includes(s));
  if (last === "must" && mentioned.length) {
    if (/nice-to-have|not (a )?must|optional/.test(t)) {
      // Demote, but never leave the card without a must-have.
      const must = draft.must.filter((s) => !mentioned.includes(s));
      if (must.length) {
        draft.must = must;
        draft.nice = uniq([...draft.nice, ...mentioned]);
      }
    } else {
      draft.must = uniq([...draft.must, ...mentioned]);
      draft.nice = draft.nice.filter((s) => !draft.must.includes(s));
    }
  } else {
    draft.nice = uniq([...draft.nice, ...found]);
  }
  // Summary: the first message, replaced by the concrete tasks once we have them.
  if (!askedIn.length) draft.summary = raw.slice(0, 400);
  if (last === "tasks" && raw.trim().split(/\s+/).length >= 6) draft.summary = raw.slice(0, 400);

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
    const dev = DEV_WORDS.test(t);
    return dev
      ? ask(
          "area",
          "Happy to help. “Dev” covers a lot of ground: what kind of software would they work on?",
          areaOptions(true, pool),
        )
      : ask("area", "Got it. Which area is the role in? Rough is fine.", areaOptions(false, pool));
  }

  if (!asked.has("tasks"))
    return ask(
      "tasks",
      `${picked}What skills would suit candidates for this role? Name a few and I'll match them to the EU skills list.`,
      relatedOptions(draft, pool),
    );

  if (!asked.has("must")) {
    if (!draft.must.length) {
      const proposal = [...skills].sort((a, b) => mustPriority(a) - mustPriority(b)).slice(0, 3);
      draft.must = proposal;
      draft.nice = draft.nice.filter((s) => !proposal.includes(s));
    }
    return ask(
      "must",
      `${picked}I've marked ${draft.must.map(skillLabel).join(", ")} as must-haves and the rest as nice-to-have. With that, ${relevantCount(draft, pool)} of ${pool.length} people in the pool are a relevant fit. Every extra must-have shrinks that, so 2–3 is usually right. Does it look right? You can also tap skills on the card.`,
      mustOptions(draft, pool),
    );
  }

  if (!draft.language)
    return ask(
      "language",
      `Which working language does the job need? ${languageCount("Finnish required", pool)} of ${pool.length} people in the pool work in Finnish today and ${languageCount("Finnish or English", pool)} in Finnish or English, so if Finnish can be learned on the job, “Finnish or English” keeps far more people in.`,
      ["Finnish or English", "English is fine", "Finnish required from day one"],
    );

  if (!draft.timing.start)
    return ask(
      "timing",
      `When should they start, and on what kind of contract? ${availableBy("asap", pool) ?? 0} people in the pool are available immediately.`,
      timingOptions(pool),
    );

  if (!draft.mode) return ask("mode", "Last one: how will they work?", modeOptions(pool));

  if (!draft.title) draft.title = `${skillLabel(draft.must[0] ?? skills[0])} specialist`;

  return {
    reply:
      "That's everything I need. Review the need card, edit anything that's off, and approve it when you're happy. Suitable candidates appear once you do.",
    quickReplies: [],
    draft,
    asked: askedIn,
    ready: true,
  };
}
