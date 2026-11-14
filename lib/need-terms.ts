import type { Talent } from "./types";

/**
 * Working language and way of working on a need card are free text: companies (and the
 * intake assistant) can write "Swedish or English" or "On-site 4 days a week" instead of
 * picking a preset. These helpers read that text back into something countable for the
 * pool numbers and the schedule. They never feed into match scoring, which uses skills only.
 */

/** Whole-word match that also works for letters like ä and å (a plain word boundary does not). */
const word = (alternatives: string) => new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, "u");

/** Language names as people write them in English, Finnish and Swedish → the profile name. */
const LANGUAGE_WORDS: [string, RegExp][] = [
  ["Finnish", word("finnish|suomi|suomea?|suomen|finska")],
  ["Swedish", word("swedish|ruotsi|ruotsia?|svenska")],
  ["English", word("english|englanti|englantia?|engelska")],
  ["German", word("german|saksa|saksaa?|tyska")],
  ["Russian", word("russian|venäjä|venäjää|ryska")],
  ["Estonian", word("estonian|viro|viroa|eesti|estniska")],
  ["Ukrainian", word("ukrainian|ukraina|ukrainaa|ukrainska")],
  ["Arabic", word("arabic|arabia|arabiaa|arabiska")],
  ["Spanish", word("spanish|espanja|espanjaa|spanska")],
  ["Polish", word("polish|puola|puolaa|polska")],
  ["Portuguese", word("portuguese|portugali|portugalia|portugisiska")],
  ["Mandarin", word("mandarin|chinese|kiina|kiinaa|kinesiska")],
  ["Vietnamese", word("vietnamese|vietnam|vietnamia")],
  ["Somali", word("somali|somalia|somaliska")],
  ["Hindi", word("hindi")],
  ["Tamil", word("tamil")],
  ["Tagalog", word("tagalog|filipino")],
  ["Yoruba", word("yoruba")],
];

const ALTERNATIVE = new RegExp(`${word("or|either|tai|eller|any of|one of").source}|/`, "u");

export type LanguageRule = { langs: string[]; any: boolean };

/**
 * The languages a requirement names and whether any one of them is enough.
 * "English OK" → English; "Finnish or English" → either; "Finnish and Swedish" → both.
 * Returns null when no known language is named (then nobody is excluded by language).
 */
export function languageRule(text: string): LanguageRule | null {
  const t = text.toLowerCase();
  const langs = LANGUAGE_WORDS.filter(([, re]) => re.test(t)).map(([name]) => name);
  if (!langs.length) return null;
  return { langs, any: langs.length > 1 && ALTERNATIVE.test(t) };
}

const works = (t: Talent, lang: string) => t.languages.some((l) => l.lang === lang && l.level !== "Learning");

/** People who can work in the required language(s), at working level or better. */
export function speaksRequired(text: string, t: Talent) {
  const rule = languageRule(text);
  if (!rule) return true;
  return rule.any ? rule.langs.some((l) => works(t, l)) : rule.langs.every((l) => works(t, l));
}

/** True when the requirement only accepts Finnish, the one that most often shrinks the pool. */
export function onlyFinnish(text: string) {
  const rule = languageRule(text);
  return !!rule && rule.langs.includes("Finnish") && !(rule.any && rule.langs.length > 1);
}

/** "Native speaker" style requirements screen people out by origin, not by skill. */
export const asksNativeSpeaker = (text: string) =>
  word("native|mother tongue|first language|äidinkieli|äidinkielenä|modersmål").test(text.toLowerCase());

export type ModeKind = "On-site" | "Hybrid" | "Remote";

/** The closest standard way of working for free text, or null if it can't be told. */
export function modeKind(text: string): ModeKind | null {
  const t = text.toLowerCase();
  if (
    /hybrid|hybridi|some days|days a week|päivää viikossa|dagar i veckan|partly remote|osittain etä/.test(t)
  )
    return "Hybrid";
  const remote = /remote|online|from home|etä|distans|hemifrån/.test(t);
  const onsite = /on-?site|office|lähi|toimisto|kontor|on location|at the site|in person|paikan päällä/.test(
    t,
  );
  if (remote && onsite) return "Hybrid";
  if (remote) return "Remote";
  if (onsite) return "On-site";
  return null;
}

/** People open to this way of working. Unknown text excludes nobody. */
export function openToMode(text: string, t: Talent) {
  const kind = modeKind(text);
  return !kind || t.mode === "Any" || t.mode === kind;
}
