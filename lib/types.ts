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

export type Engagement = "Permanent" | "Fixed-term" | "Part-time" | "Internship / trainee";

export type NeedTiming = { start: string; engagement: Engagement };

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
  /** When the role starts and on what terms. Optional for older seeds. */
  timing?: NeedTiming;
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

/** One line of the score: how many points one required skill earned, and why. */
export type ScoreLine = {
  skill: string;
  must: boolean;
  kind: "direct" | "transfer" | "gap";
  /** Points available for this skill (must-have 3, nice-to-have 1). */
  max: number;
  points: number;
  /** The talent's own level for the skill used (direct or transfer source). */
  level?: "evidenced" | "claimed";
  /** Transfer only: the talent's skill that relates to the required one. */
  from?: string;
  /** Transfer only: strength of the skill relation (0..1). */
  relation?: number;
  /** Transfer only: cached ESCO occupations whose profile lists both skills. */
  occupations?: string[];
};

export type MatchExplanation = {
  needId: string;
  talentId: string;
  score: number; // 0..1, = points / maxPoints
  points: number;
  maxPoints: number;
  breakdown: ScoreLine[];
  shared: { skill: string; level: "evidenced" | "claimed"; must: boolean }[];
  transferable: { from: string; to: string; must: boolean }[];
  gaps: { skill: string; must: boolean }[];
  quotes: Evidence[];
  suggested: boolean;
};

/** A human decision on one suggested pair. Only an organiser creates one; nothing is automatic. */
export type Decision = {
  status: "approved" | "rejected";
  reason: string;
  note?: string;
  at: string;
};

/** Append-only audit trail. Entries are never edited or removed. */
export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: "approved" | "rejected" | "edited" | "reverted";
  needId: string;
  talentId: string;
  /** Decision status before and after this action ("none" = no decision). */
  from: Decision["status"] | "none";
  to: Decision["status"] | "none";
  reason: string;
  note?: string;
};

export type FeedbackSide = "company" | "talent";

/** Next step each side can choose. "continue" = interview (company) / want to continue (candidate). */
export type NextStep = "continue" | "keep-in-touch" | "stop";

/**
 * One side's structured feedback after a meeting. It rates the meeting and the
 * accuracy of the card, never the person.
 */
export type SideFeedback = {
  held: boolean;
  /** 1–5: was the meeting worth the time? Only when held. */
  usefulness?: number;
  /** 1–5: did the card (skill card for the company, need card for the candidate) match reality? */
  accuracy?: number;
  nextStep?: NextStep;
  /** Optional idea for the organiser. Shown to organisers with identifying details removed. */
  improve?: string;
  at: string;
};

export type Feedback = Partial<Record<FeedbackSide, SideFeedback>>;
