import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { explainMatch } from "@/lib/match";
import { explainInput, rulesWhy } from "@/lib/match-explain";

/** Identifying values that must never reach the "why this match" explainer. */
const identifying = (t: (typeof SEED_TALENT)[number]) => [
  t.revealName,
  t.alias,
  t.headline,
  t.audit.origin,
  t.audit.education,
  t.audit.path,
];

describe("why-this-match input", () => {
  it("contains only the scoring output, the role and evidence quotes", () => {
    const m = explainMatch(SEED_NEEDS[0], SEED_TALENT[0]);
    const input = explainInput(SEED_NEEDS[0].title, m);
    expect(Object.keys(input).sort()).toEqual([
      "evidence",
      "lines",
      "points",
      "role",
      "scorePercent",
      "suggested",
    ]);
    for (const l of input.lines)
      for (const k of Object.keys(l))
        expect([
          "skill",
          "requirement",
          "result",
          "level",
          "via",
          "relation",
          "sharedOccupations",
          "points",
        ]).toContain(k);
  });

  it("is identical whatever the person's name, background, languages or audit attributes", () => {
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT) {
        const base = explainInput(n.title, explainMatch(n, t));
        const twin = {
          ...t,
          revealName: "Someone Else",
          alias: "Candidate Z",
          headline: "Different headline",
          previousField: "Different background",
          languages: [{ lang: "Somali", level: "Native" as const }],
          availability: "Never",
          mode: "Remote" as const,
          audit: { origin: "Outside EU", education: "Vocational", path: "Career changer" } as const,
        };
        expect(explainInput(n.title, explainMatch(n, twin))).toEqual(base);
      }
  });

  it("never contains the person's name, alias, headline or audit attributes", () => {
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT) {
        // Evidence quotes are the person's own words; check the scoring part strictly.
        const scoring = JSON.stringify({ ...explainInput(n.title, explainMatch(n, t)), evidence: [] });
        for (const value of identifying(t)) expect(scoring).not.toContain(value);
      }
  });

  it("template text reports the same score as the rules", () => {
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT.slice(0, 8)) {
        const m = explainMatch(n, t);
        const { why, ask } = rulesWhy(explainInput(n.title, m));
        expect(why).toContain(`${Math.round(m.score * 100)}%`);
        expect(ask.length).toBeGreaterThan(10);
        expect(why).not.toMatch(/\b(hire|reject|best candidate|good fit)\b/i);
      }
  });
});
