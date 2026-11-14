import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { interestStatus, proofBoost, rolesFor, unlockSkills } from "@/lib/explore";
import type { MatchNeed, MatchTalent } from "@/lib/match";

const need = (id: string, must: string[], nice: string[] = []): MatchNeed => ({ id, must, nice });
const me = (skills: MatchTalent["skills"]): MatchTalent => ({ id: "T-T", skills, evidence: [] });

describe("rolesFor", () => {
  it("ranks every role by skill match, best first", () => {
    const t = SEED_TALENT[0];
    const ranked = rolesFor(SEED_NEEDS, t);
    expect(ranked).toHaveLength(SEED_NEEDS.length);
    for (let i = 1; i < ranked.length; i++)
      expect(ranked[i - 1].m.score).toBeGreaterThanOrEqual(ranked[i].m.score);
  });

  it("does not depend on protected attributes", () => {
    for (const t of SEED_TALENT.slice(0, 5)) {
      const flipped = {
        ...t,
        audit: { origin: "Outside EU", education: "Self-taught / bootcamp", path: "Career changer" } as const,
        languages: [{ lang: "Arabic", level: "Native" as const }],
      };
      expect(rolesFor(SEED_NEEDS, flipped).map((r) => r.m.score)).toEqual(
        rolesFor(SEED_NEEDS, t).map((r) => r.m.score),
      );
    }
  });
});

describe("proofBoost", () => {
  it("shows how much a stated skill gains once it is shown", () => {
    const b = proofBoost(need("N", ["python"]), me([{ id: "python", level: "claimed" }]));
    expect(b).toEqual({ skills: ["python"], before: 0.5, after: 1 });
  });

  it("is null when everything relevant is already shown", () => {
    expect(proofBoost(need("N", ["python"]), me([{ id: "python", level: "evidenced" }]))).toBeNull();
  });

  it("ignores stated skills the role does not use", () => {
    const t = me([
      { id: "python", level: "evidenced" },
      { id: "elderly-care", level: "claimed" },
    ]);
    expect(proofBoost(need("N", ["python"]), t)).toBeNull();
  });
});

describe("unlockSkills", () => {
  it("puts the skill that opens the most roles first", () => {
    const needs = [
      need("A", ["python", "sql"]),
      need("B", ["python", "sql"]),
      need("C", ["python", "x-other"]),
    ];
    const [top] = unlockSkills(needs, me([{ id: "python", level: "claimed" }]));
    expect(top.skill).toBe("sql");
    expect(top.opened.sort()).toEqual(["A", "B"]);
  });

  it("never suggests a skill the candidate already has", () => {
    const t = SEED_TALENT[0];
    const own = new Set(t.skills.map((s) => s.id));
    for (const u of unlockSkills(SEED_NEEDS, t, 10)) expect(own.has(u.skill)).toBe(false);
  });
});

describe("interestStatus", () => {
  it("follows the candidate's view of the pair", () => {
    expect(interestStatus(undefined, undefined, undefined)).toBe("none");
    expect(interestStatus({ talent: true }, undefined, undefined)).toBe("asked");
    expect(interestStatus({ company: true }, { status: "approved" }, undefined)).toBe("invited");
    expect(interestStatus({ company: true, talent: true }, { status: "approved" }, undefined)).toBe("both");
    expect(interestStatus({ company: true, talent: true }, { status: "approved" }, "10:20")).toBe("booked");
    expect(interestStatus({ talent: true }, { status: "rejected" }, undefined)).toBe("passed");
    expect(interestStatus({ talent: false }, { status: "approved" }, undefined)).toBe("declined");
  });
});
