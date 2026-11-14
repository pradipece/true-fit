export type SkillGroup = "Digital" | "Green transition" | "Healthcare" | "Business" | "Transversal";

/** A skill from the cached ESCO subset (data/esco/skills.json). */
export type Skill = {
  id: string;
  /** Plain-language label shown in the UI. */
  label: string;
  group: SkillGroup;
  /** ESCO concept URI, e.g. http://data.europa.eu/esco/skill/… */
  uri: string;
  /** ESCO preferred label (English). */
  escoLabel: string;
  /** "exact" = our skill is the ESCO concept; "close" = nearest ESCO concept. */
  match: "exact" | "close";
  /** ESCO preferred labels in other languages (fi, sv). */
  labels: Partial<Record<string, string>>;
  /** ESCO alternative labels (English synonyms). */
  altLabels: string[];
  /** Free-text hints for the intake assistant (substring match, multilingual). */
  keywords: string[];
};

/** An occupation from the cached ESCO subset (data/esco/occupations.json). */
export type Occupation = {
  id: string;
  uri: string;
  /** ESCO preferred label (English). */
  label: string;
  /** ISCO-08 unit group code. */
  isco: string | null;
  /** ESCO preferred labels by language code. */
  labels: Partial<Record<string, string>>;
  altLabels: { en: string[]; fi: string[] };
  /** Skills from our subset that this occupation typically brings. */
  skills: string[];
  /** Informal or foreign titles seen at events. */
  extraTitles: string[];
  /** Everyday Finnish title when ESCO's is awkward. */
  fiTitle?: string;
};

/** Synthetic company. */
export type Company = {
  id: string;
  name: string;
  blurb: string;
  sector: string;
  location: string;
};

export type Need = {
  id: string;
  companyId?: string;
  company: string;
  companyBlurb: string;
  title: string;
  /** ESCO occupation id this role maps to, if any. */
  occupation?: string;
  summary: string;
  must: string[];
  nice: string[];
  language: "English OK" | "Finnish required" | "Finnish or English";
  mode: "On-site" | "Hybrid" | "Remote";
  submittedWeeksBefore: number;
  createdByUser?: boolean;
};

export type SkillClaim = { id: string; level: "evidenced" | "claimed" };

export type Evidence = {
  prompt: string;
  excerpt: string;
  skills: string[];
  kind: "scenario" | "voice" | "sample";
};

/** Attributes used ONLY for aggregate fairness auditing. Never shown in matching UI, never scored. */
export type AuditAttributes = {
  origin: "Finland" | "EU/EEA" | "Outside EU";
  education: "University" | "Vocational" | "Self-taught / bootcamp";
  path: "Linear" | "Career changer";
};

export type Talent = {
  id: string;
  alias: string;
  /** Revealed only after mutual opt-in. Synthetic. */
  revealName: string;
  headline: string;
  previousField: string;
  skills: SkillClaim[];
  evidence: Evidence[];
  languages: { lang: string; level: "Native" | "Fluent" | "Working" | "Learning" }[];
  availability: string;
  mode: "On-site" | "Hybrid" | "Remote" | "Any";
  audit: AuditAttributes;
  createdByUser?: boolean;
};

export type MatchExplanation = {
  needId: string;
  talentId: string;
  score: number; // 0..1, shown transparently with breakdown
  shared: { skill: string; level: "evidenced" | "claimed"; must: boolean }[];
  transferable: { from: string; to: string; must: boolean }[];
  gaps: { skill: string; must: boolean }[];
  quotes: Evidence[];
  suggested: boolean;
};

export type Decision = {
  status: "approved" | "dismissed";
  note?: string;
  reason?: string;
  at: string;
};

export type Feedback = {
  evidenceAccuracy: number;
  nextStep: "Interview" | "Keep in touch" | "Not a fit";
  comment: string;
};
