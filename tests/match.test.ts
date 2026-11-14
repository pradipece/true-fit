import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { adjacency } from "@/lib/esco";
import { explainMatch, matchesForNeed, SCORING, SUGGEST_THRESHOLD } from "@/lib/match";
import type { AuditAttributes, Need, Talent } from "@/lib/types";

const need = (must: string[], nice: string[] = []): Need => ({
  id: "N-T",
  company: "Test Oy",
  companyBlurb: "",
  title: "Test role",
  summary: "",
  must,
  nice,
  language: "English OK",
  mode: "Hybrid",
  submittedWeeksBefore: 3,
});

const talent = (skills: Talent["skills"], patch: Partial<Talent> = {}): Talent => ({
  id: "T-T",
  alias: "Candidate T-T",
  revealName: "Test Person",
  headline: "",
  previousField: "",
  skills,
  evidence: [],
  languages: [{ lang: "English", level: "Fluent" }],
  availability: "Now",
  mode: "Any",
  audit: { origin: "Finland", education: "University", path: "Linear" },
  ...patch,
});

describe("scoring rules", () => {
  it("gives full points for an evidenced must-have and half for a self-reported one", () => {
    expect(explainMatch(need(["python"]), talent([{ id: "python", level: "evidenced" }])).score).toBe(1);
    expect(explainMatch(need(["python"]), talent([{ id: "python", level: "claimed" }])).score).toBe(0.5);
  });

  it("weights must-haves 3:1 against nice-to-haves", () => {
    const m = explainMatch(need(["python"], ["sql"]), talent([{ id: "sql", level: "evidenced" }]));
    expect(m.maxPoints).toBe(SCORING.mustWeight + SCORING.niceWeight);
    expect(m.points).toBe(SCORING.niceWeight);
    expect(m.score).toBeCloseTo(1 / 4);
  });

  it("credits a related skill through the skill relation, below a direct match", () => {
    expect(adjacency("logistics", "supply")).toBe(0.7);
    const m = explainMatch(need(["supply"]), talent([{ id: "logistics", level: "evidenced" }]));
    const line = m.breakdown[0];
    expect(line.kind).toBe("transfer");
    expect(line.from).toBe("logistics");
    expect(line.points).toBeCloseTo(SCORING.mustWeight * 0.7 * SCORING.transferFactor);
    expect(line.occupations).toContain("logistics analyst");
    expect(m.score).toBeLessThan(1);
  });

  it("ignores weak relations below the transfer minimum", () => {
    // logistics ↔ analysis is 0.35; self-reported halves it to 0.175 < 0.3
    const m = explainMatch(need(["analysis"]), talent([{ id: "logistics", level: "claimed" }]));
    expect(m.breakdown[0].kind).toBe("gap");
    expect(m.score).toBe(0);
  });

  it("score equals the sum of breakdown points over max points", () => {
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT) {
        const m = explainMatch(n, t);
        const sum = m.breakdown.reduce((s, l) => s + l.points, 0);
        expect(m.points).toBeCloseTo(sum);
        expect(m.score).toBeCloseTo(m.maxPoints ? sum / m.maxPoints : 0);
        expect(m.breakdown).toHaveLength(n.must.length + n.nice.length);
        expect(m.suggested).toBe(m.score >= SUGGEST_THRESHOLD);
      }
  });

  it("evidence quotes are context only and never change the score", () => {
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT)
        expect(explainMatch(n, { ...t, evidence: [] }).score).toBe(explainMatch(n, t).score);
  });
});

describe("protected attributes are not used in scoring", () => {
  const ALLOWED = new Set(["id", "skills", "evidence"]);

  /** A talent that throws if matching reads any field other than id, skills or evidence. */
  const guarded = (t: Talent) =>
    new Proxy(t, {
      get(target, prop, receiver) {
        if (typeof prop === "string" && !ALLOWED.has(prop))
          throw new Error(`Matching read the protected field "${prop}"`);
        return Reflect.get(target, prop, receiver);
      },
    });

  it("never reads name, headline, background, languages, availability, mode or audit fields", () => {
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT) expect(() => explainMatch(n, guarded(t))).not.toThrow();
    expect(() => matchesForNeed(SEED_NEEDS[0], SEED_TALENT.map(guarded))).not.toThrow();
  });

  const ORIGINS: AuditAttributes["origin"][] = ["Finland", "EU/EEA", "Outside EU"];
  const EDUCATION: AuditAttributes["education"][] = ["University", "Vocational", "Self-taught / bootcamp"];
  const PATHS: AuditAttributes["path"][] = ["Linear", "Career changer"];

  it("gives identical results for every combination of origin, education and career path", () => {
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT) {
        const base = explainMatch(n, t);
        for (const origin of ORIGINS)
          for (const education of EDUCATION)
            for (const path of PATHS) {
              const variant: Talent = { ...t, audit: { origin, education, path } };
              expect(explainMatch(n, variant)).toEqual(base);
            }
      }
  });

  it("gives identical results whatever languages, name or background a person has", () => {
    const variants: Partial<Talent>[] = [
      { languages: [{ lang: "Finnish", level: "Native" }] },
      {
        languages: [
          { lang: "Arabic", level: "Native" },
          { lang: "Finnish", level: "Learning" },
        ],
      },
      { languages: [] },
      { revealName: "Matti Virtanen", alias: "Candidate X" },
      { revealName: "Amina Hassan", alias: "Candidate Y" },
      { headline: "Born and raised in Espoo", previousField: "Aalto University graduate" },
      { headline: "Refugee from Syria, 52 years old", previousField: "Self-taught" },
      { availability: "In 6 months", mode: "Remote" },
    ];
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT) {
        const base = explainMatch(n, t);
        for (const v of variants) expect(explainMatch(n, { ...t, ...v })).toEqual(base);
      }
  });

  it("scores counterfactual twins with the same skills identically", () => {
    const skills: Talent["skills"] = [
      { id: "python", level: "evidenced" },
      { id: "sql", level: "claimed" },
      { id: "logistics", level: "evidenced" },
    ];
    const a = talent(skills, {
      revealName: "Matti",
      languages: [{ lang: "Finnish", level: "Native" }],
      audit: { origin: "Finland", education: "University", path: "Linear" },
    });
    const b = talent(skills, {
      revealName: "Chidi",
      languages: [{ lang: "English", level: "Fluent" }],
      audit: { origin: "Outside EU", education: "Self-taught / bootcamp", path: "Career changer" },
    });
    for (const n of SEED_NEEDS) expect(explainMatch(n, b)).toEqual(explainMatch(n, a));
  });

  it("ignores the need's language requirement and way of working", () => {
    for (const n of SEED_NEEDS)
      for (const t of SEED_TALENT) {
        const base = explainMatch(n, t).score;
        for (const language of ["English OK", "Finnish required", "Finnish or English"] as const)
          for (const mode of ["On-site", "Hybrid", "Remote"] as const) {
            const variant: Need = { ...n, language, mode };
            expect(explainMatch(variant, t).score).toBe(base);
          }
      }
  });
});
