import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { pairKey } from "@/lib/match";
import {
  actionFor,
  auditCsv,
  auditEntry,
  funnel,
  needSupply,
  OTHER,
  overview,
  poolProfile,
  reasonError,
  reviewList,
} from "@/lib/oversight";
import type { Decision } from "@/lib/types";

describe("no automatic rejection", () => {
  it("lists every person in the pool for every need: suggestions plus everyone else", () => {
    for (const n of SEED_NEEDS) {
      const { suggested, notSuggested } = reviewList(n, SEED_TALENT);
      expect(suggested.length + notSuggested.length).toBe(SEED_TALENT.length);
      expect(new Set([...suggested, ...notSuggested].map((m) => m.talentId))).toEqual(
        new Set(SEED_TALENT.map((t) => t.id)),
      );
    }
  });

  it("creates no decisions on its own: with none recorded, nobody counts as approved or rejected", () => {
    const o = overview(SEED_NEEDS, SEED_TALENT, {}, {}, {});
    expect(o.approved).toBe(0);
    expect(o.rejected).toBe(0);
    const total = SEED_NEEDS.reduce((sum, n) => sum + reviewList(n, SEED_TALENT).suggested.length, 0);
    expect(o.awaitingReview).toBe(total);
  });
});

describe("reasons and audit log", () => {
  it("requires a reason for every action, and a note for Other", () => {
    expect(reasonError("", "")).toBeTruthy();
    expect(reasonError(OTHER, "")).toBeTruthy();
    expect(reasonError(OTHER, "Company changed the role")).toBeNull();
    expect(reasonError("Strong transferable skills", "")).toBeNull();
  });

  it("logs first decisions as approve/reject and later changes as edits", () => {
    const prev: Decision = { status: "approved", reason: "x", at: "2026-11-10T00:00:00.000Z" };
    expect(actionFor(undefined, "approved")).toBe("approved");
    expect(actionFor(undefined, "rejected")).toBe("rejected");
    expect(actionFor(prev, "rejected")).toBe("edited");
  });

  it("records who, what, from and to, with unique ids", () => {
    const key = pairKey("N-01", "T-30");
    const a = auditEntry(key, "approved", "none", "approved", "Strong transferable skills", "  ");
    const b = auditEntry(key, "reverted", "approved", "none", "Decided too early");
    expect(a).toMatchObject({
      needId: "N-01",
      talentId: "T-30",
      from: "none",
      to: "approved",
      actor: "Organiser (demo)",
    });
    expect(a.note).toBeUndefined();
    expect(a.id).not.toBe(b.id);
  });

  it("exports CSV oldest first with quoting", () => {
    const key = pairKey("N-01", "T-30");
    const csv = auditCsv(
      [
        auditEntry(
          key,
          "edited",
          "approved",
          "rejected",
          OTHER,
          'Said "no", twice',
          "2026-11-12T10:00:00.000Z",
        ),
        auditEntry(
          key,
          "approved",
          "none",
          "approved",
          "Strong transferable skills",
          undefined,
          "2026-11-11T10:00:00.000Z",
        ),
      ],
      SEED_NEEDS,
      SEED_TALENT,
    );
    const lines = csv.split("\n");
    expect(lines[0]).toBe("time,actor,action,need,candidate,from,to,reason,note");
    expect(lines[1]).toContain(",approved,");
    expect(lines[2]).toContain('"Said ""no"", twice"');
    expect(lines[1]).toContain("Data engineer, battery telemetry");
  });
});

describe("dashboard numbers", () => {
  const decisions: Record<string, Decision> = {
    [pairKey("N-01", "T-30")]: { status: "approved", reason: "x", at: "" },
    [pairKey("N-02", "T-12")]: { status: "approved", reason: "x", at: "" },
    [pairKey("N-02", "T-01")]: { status: "rejected", reason: "y", at: "" },
  };
  const optIns = { [pairKey("N-02", "T-12")]: { company: true, talent: true } };
  const slots = { [pairKey("N-02", "T-12")]: "10:20" };

  it("counts each funnel stage from recorded human actions", () => {
    const f = funnel(SEED_NEEDS, SEED_TALENT, decisions, optIns, slots, {});
    expect(f.map((s) => s.value).slice(1)).toEqual([2, 1, 1, 0]);
  });

  it("labels supply per need from the same rule as suggestions", () => {
    for (const s of needSupply(SEED_NEEDS, SEED_TALENT, {})) {
      expect(s.relevant).toBe(reviewList(s.need, SEED_TALENT).suggested.length);
      expect(s.supply).toBe(s.relevant >= 3 ? "good" : s.relevant > 0 ? "few" : "none");
    }
  });

  it("profiles the pool with counts only", () => {
    const p = poolProfile(SEED_TALENT);
    expect(p.areas).toHaveLength(5);
    expect(p.topSkills[0].people).toBeGreaterThanOrEqual(p.topSkills.at(-1)!.people);
    expect(JSON.stringify(p)).not.toMatch(/revealName|T-\d+/);
  });
});
