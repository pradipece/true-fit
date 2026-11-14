import { describe, expect, it } from "vitest";
import { SEED_NEEDS } from "@/lib/data";
import { currentIdentity, OWN_ID, pairOwner } from "@/lib/identity";
import { pairKey } from "@/lib/match";
import { agendaFor } from "@/lib/schedule";
import { SEED_TALENT } from "@/lib/seed";

const n1 = SEED_NEEDS.find((n) => n.id === "N-01")!;
const n2 = SEED_NEEDS.find((n) => n.id === "N-02")!;
const k1 = pairKey("N-01", "T-30");
const k2 = pairKey("N-02", "T-12");
const own = { ...n1, id: "N-YOU", companyId: "C-YOU" };

describe("one identity per side", () => {
  it("knows whose pair it is on each side", () => {
    expect(pairOwner("company", k1, SEED_NEEDS)).toBe(n1.companyId);
    expect(pairOwner("talent", k1, SEED_NEEDS)).toBe("T-30");
  });

  it("keeps an explicit choice, else prefers the person's own card, else someone with matches", () => {
    const ids = [...new Set(SEED_NEEDS.map((n) => n.companyId!)), "C-YOU"];
    const other = ids.find((id) => id !== n1.companyId)!;
    expect(currentIdentity("company", other, ids, [k1], SEED_NEEDS)).toBe(other);
    expect(currentIdentity("company", "gone", ids, [k1], SEED_NEEDS)).toBe(n1.companyId);
    const withOwn = [...SEED_NEEDS, own];
    expect(currentIdentity("company", undefined, ids, [k1, pairKey("N-YOU", "T-01")], withOwn)).toBe("C-YOU");
    expect(currentIdentity("talent", undefined, ["T-01"], [], SEED_NEEDS)).toBe(OWN_ID.talent);
  });

  it("an agenda only ever lists the participant's own pairs", () => {
    const company = n1.companyId!;
    const passed = { answer: true, slot: "10:00", result: "passed" as const };
    const state = {
      needs: SEED_NEEDS,
      talent: SEED_TALENT,
      decisions: {
        [k1]: { status: "approved" as const, reason: "x", at: "" },
        [k2]: { status: "approved" as const, reason: "x", at: "" },
      },
      optIns: {},
      slots: {},
      screening: { [k1]: passed, [k2]: passed },
      offers: {},
    };
    const items = agendaFor({ kind: "company", id: company }, state);
    expect(items.map((i) => i.key)).toEqual(n2.companyId === company ? [k1, k2] : [k1]);
    const t = agendaFor({ kind: "talent", id: "T-12" }, state);
    expect(new Set(t.map((i) => i.key))).toEqual(new Set([k2]));
  });
});
