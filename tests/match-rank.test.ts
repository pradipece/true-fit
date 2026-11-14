import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { matchesForNeed } from "@/lib/match";
import { finishRanking, MAX_RANKED, rankInput, rulesRank } from "@/lib/match-rank";

const need = SEED_NEEDS[0];
const matches = matchesForNeed(need, SEED_TALENT);
const input = rankInput(need.title, matches);
const ids = matches.slice(0, MAX_RANKED).map((m) => m.talentId);

describe("AI fit-rate input", () => {
  it("labels candidates C1…Cn and carries no ids or identifying values", () => {
    expect(input.candidates.map((c) => c.label)).toEqual(ids.map((_, i) => `C${i + 1}`));
    const text = JSON.stringify(input);
    for (const t of SEED_TALENT) {
      expect(text).not.toContain(`"${t.id}"`);
      for (const v of [
        t.revealName,
        t.alias,
        t.headline,
        t.audit.origin,
        t.audit.education,
        t.audit.path,
        ...Object.values(t.contact ?? {}),
      ])
        if (v && v.length > 3) expect(text).not.toContain(v);
    }
    for (const c of input.candidates)
      expect(Object.keys(c).sort()).toEqual([
        "evidence",
        "label",
        "lines",
        "points",
        "scorePercent",
        "suggested",
      ]);
  });
});

describe("finishRanking", () => {
  it("drops unknown and repeated labels, clamps rates and fills gaps from rules", () => {
    const out = finishRanking(input, ids, [
      { label: "C2", fit: 140, reason: "Strong evidence." },
      { label: "C2", fit: 1, reason: "dup" },
      { label: "C999", fit: 99, reason: "unknown" },
      { label: "C1", fit: "high", reason: "bad fit" },
    ]);
    expect(out).toHaveLength(ids.length);
    expect(new Set(out.map((r) => r.talentId))).toEqual(new Set(ids));
    expect(out[0]).toEqual({ talentId: ids[1], fit: 100, reason: "Strong evidence." });
    const rules = rulesRank(input);
    expect(out.find((r) => r.talentId === ids[0])?.fit).toBe(rules[0].fit);
  });

  it("is sorted by fit, keeping skill-match order on ties", () => {
    const out = finishRanking(input, ids, null);
    for (let i = 1; i < out.length; i++) expect(out[i - 1].fit).toBeGreaterThanOrEqual(out[i].fit);
  });
});
