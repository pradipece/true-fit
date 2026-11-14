import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { LANGUAGE_REPLIES, withLanguageReplies } from "@/lib/intake";
import { explainMatch } from "@/lib/match";
import {
  companiesByFit,
  finishRoleRanking,
  roleRankInput,
  rulesRoleRanking,
  type RoleIn,
} from "@/lib/role-rank";

const roles: RoleIn[] = SEED_NEEDS.map((n) => ({
  id: n.id,
  title: n.title,
  company: n.company,
  companyId: n.companyId ?? "C-YOU",
  must: n.must,
  nice: n.nice,
}));

describe("role ranking for a job seeker", () => {
  const t = SEED_TALENT[0];
  const { input, needIds } = roleRankInput(roles, t);

  it("labels roles R1…Rn in skill-match order and sends no ids", () => {
    expect(input.candidates.map((c) => c.label)).toEqual(needIds.map((_, i) => `R${i + 1}`));
    const json = JSON.stringify(input);
    for (const id of needIds) expect(json).not.toContain(`"${id}"`);
    expect(json).not.toContain(t.id);
  });

  it("falls back to rules and fills roles the model skipped", () => {
    const ranked = finishRoleRanking(input, needIds, [{ label: "R2", fit: 99, reason: "Strong" }]);
    expect(ranked).toHaveLength(needIds.length);
    expect(ranked[0]).toEqual({ needId: needIds[1], fit: 99, reason: "Strong" });
  });

  it("groups by company, best role first, highest fit first", () => {
    const score = (id: string) =>
      explainMatch(
        roles.find((r) => r.id === id)!,
        t,
      ).score;
    const companies = companiesByFit(roles, rulesRoleRanking(input, needIds), score);
    expect(new Set(companies.map((c) => c.companyId)).size).toBe(companies.length);
    for (let i = 1; i < companies.length; i++)
      expect(companies[i - 1].best.fit).toBeGreaterThanOrEqual(companies[i].best.fit);
    for (const c of companies) expect(c.best).toBe(c.roles[0]);
  });

  it("does not depend on protected attributes", () => {
    const flipped = {
      ...t,
      audit: { origin: "Outside EU", education: "Self-taught / bootcamp", path: "Career changer" } as const,
      languages: [{ lang: "Arabic", level: "Native" as const }],
    };
    const a = roleRankInput(roles, flipped);
    expect(rulesRoleRanking(a.input, a.needIds)).toEqual(rulesRoleRanking(input, needIds));
  });
});

describe("withLanguageReplies", () => {
  it("offers the language options when the assistant asks about language", () => {
    expect(withLanguageReplies("Which working language does the job need?", "", ["x"])).toEqual(
      LANGUAGE_REPLIES,
    );
    expect(withLanguageReplies("Mikä on työkieli?", "", ["x"])).toEqual(LANGUAGE_REPLIES);
    expect(withLanguageReplies("Vilket språk behövs?", "", ["x"])).toEqual(LANGUAGE_REPLIES);
  });
  it("keeps the model's replies otherwise", () => {
    expect(withLanguageReplies("When should they start?", "", ["ASAP"])).toEqual(["ASAP"]);
    expect(withLanguageReplies("Any other language needs?", "English OK", ["No"])).toEqual(["No"]);
  });
});
