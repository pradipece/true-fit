import type { Sample } from "../components/work-sample";
import type { EvidenceResult, Translation } from "./talent-ai";
import type { Talent, TalentContact } from "./types";

/**
 * A job seeker's profile as they build it on /talent: everything they typed or kept, so
 * it can be saved to the database (candidate_profiles, app/api/talent/profile) and
 * restored when they come back. Pure and shared by the browser and the server; the server
 * keeps only known fields with the right types (cleanDraft), never trusts the rest.
 */
export type ProfileDraft = {
  step: number;
  title: string;
  path: string;
  translation: Translation | null;
  skills: string[];
  answers: Record<string, string>;
  sample: Sample | null;
  result: EvidenceResult | null;
  mappedKey: string;
  readFor: string;
  rejected: string[];
  resolved: string[];
  headline: string;
  languages: string[];
  mode: Talent["mode"];
  availability: string;
  contact: TalentContact;
  reviewed: boolean;
};

export const MAX_DRAFT = 120_000;

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");
const strs = (v: unknown, n = 50, max = 200) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .slice(0, n)
        .map((x) => x.slice(0, max))
    : [];
const MODES: Talent["mode"][] = ["On-site", "Hybrid", "Remote", "Any"];

/** Validate a draft from a browser. Returns null if it isn't one or is too large. */
export function cleanDraft(v: unknown): ProfileDraft | null {
  if (!obj(v) || JSON.stringify(v).length > MAX_DRAFT) return null;
  const c = obj(v.contact) ? v.contact : {};
  const answers: Record<string, string> = {};
  if (obj(v.answers))
    for (const [k, a] of Object.entries(v.answers).slice(0, 20))
      if (typeof a === "string") answers[k.slice(0, 40)] = a.slice(0, 4000);
  const s = obj(v.sample) ? v.sample : null;
  return {
    step: typeof v.step === "number" && v.step >= 0 && v.step <= 3 ? Math.floor(v.step) : 0,
    title: str(v.title, 200),
    path: str(v.path, 2000),
    // AI output the browser already had; only shown back to the same person.
    translation: obj(v.translation) ? (v.translation as Translation) : null,
    skills: strs(v.skills, 20, 64),
    answers,
    sample: s
      ? { name: str(s.name, 200), description: str(s.description, 2000), excerpt: str(s.excerpt, 4000) }
      : null,
    result: obj(v.result) ? (v.result as EvidenceResult) : null,
    mappedKey: str(v.mappedKey, 20_000),
    readFor: str(v.readFor, 20_000),
    rejected: strs(v.rejected, 100),
    resolved: strs(v.resolved, 100),
    headline: str(v.headline, 200),
    languages: strs(v.languages, 12, 40),
    mode: MODES.includes(v.mode as Talent["mode"]) ? (v.mode as Talent["mode"]) : "Any",
    availability: str(v.availability, 200),
    contact: {
      fullName: str(c.fullName, 120),
      email: str(c.email, 200),
      phone: str(c.phone, 40),
      city: str(c.city, 80),
    },
    reviewed: v.reviewed === true,
  };
}
