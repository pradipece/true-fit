import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { biasAudit, explainMatch } from "@/lib/match";

describe("bias check", () => {
  const audit = biasAudit(SEED_NEEDS, SEED_TALENT);

  it("covers nationality, language, education and career path", () => {
    expect(audit.map((a) => a.label)).toEqual([
      "Nationality / origin",
      "Language",
      "Education",
      "Career path",
    ]);
  });

  it("puts every person in exactly one group per dimension", () => {
    for (const a of audit) expect(a.rows.reduce((s, r) => s + r.people, 0)).toBe(SEED_TALENT.length);
  });

  it("computes the four-fifths ratio from the lowest and highest match rate", () => {
    for (const a of audit) {
      const rates = a.rows.map((r) => r.rate);
      expect(a.ratio).toBeCloseTo(Math.min(...rates) / Math.max(...rates));
      for (const r of a.rows) expect(r.avgBest).toBeGreaterThanOrEqual(0);
    }
  });

  it("matches the scorer: a person counts as matched if any need suggests them", () => {
    const origin = audit[0];
    for (const r of origin.rows) {
      const people = SEED_TALENT.filter((t) => t.audit.origin === r.group);
      const matched = people.filter((t) => SEED_NEEDS.some((n) => explainMatch(n, t).suggested)).length;
      expect(r.rate).toBeCloseTo(matched / people.length);
    }
  });

  it("the synthetic pool passes the four-fifths rule on every dimension", () => {
    for (const a of audit) expect(a.ratio).toBeGreaterThanOrEqual(0.8);
  });
});
