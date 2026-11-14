/** The demo is one guided flow. Header nav and the prev/next bar both read from this list. */
export const STEPS = [
  { href: "/company", label: "Company", title: "Describe a need", step: 1 },
  { href: "/talent", label: "Talent", title: "Build a skill card", step: 2 },
  { href: "/organiser", label: "Organiser", title: "Approve matches", step: 3 },
  { href: "/meetings", label: "Meetings", title: "Opt in, meet, follow up", step: 4 },
  { href: "/responsible", label: "Responsible AI", title: "Check fairness & compliance", step: 5 },
] as const;

export type Step = (typeof STEPS)[number];

export const FIRST_STEP = STEPS[0];
