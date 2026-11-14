import { describe, expect, it } from "vitest";
import {
  applyPatch,
  cleanPatch,
  diffSnapshot,
  EMPTY_SNAPSHOT,
  fromSnapshot,
  patchIsEmpty,
  stableJson,
  toSnapshot,
} from "@/lib/demo-state";
import { pairKey } from "@/lib/match";

const key = pairKey("N-01", "T-30");
const maps = {
  decisions: {
    [key]: {
      status: "approved" as const,
      reason: "Strong transferable skills",
      at: "2026-11-10T09:00:00.000Z",
    },
  },
  optIns: { [key]: { company: true } },
  slots: { [key]: "10:30" },
  screening: { [key]: { answer: true, slot: "10:00", result: "passed" as const, reason: "x" } },
  offers: {},
  feedback: {},
  audit: [],
  needs: [],
  talent: [],
};

describe("demo state in the database", () => {
  it("round-trips the store's maps through one row per pair", () => {
    const snap = toSnapshot(maps);
    expect(Object.keys(snap.pairs)).toEqual([key]);
    expect(fromSnapshot(snap)).toMatchObject({
      decisions: maps.decisions,
      optIns: maps.optIns,
      slots: maps.slots,
      screening: maps.screening,
    });
  });

  it("sends only what changed, and ignores the key order Postgres jsonb returns", () => {
    const snap = toSnapshot(maps);
    const reordered = JSON.parse(stableJson(snap));
    expect(patchIsEmpty(diffSnapshot(reordered, snap))).toBe(true);
    const next = toSnapshot({ ...maps, offers: { [key]: { status: "offered" as const, at: "" } } });
    const patch = diffSnapshot(snap, next);
    expect(Object.keys(patch.pairs)).toEqual([key]);
    expect(applyPatch(snap, patch)).toEqual(next);
    expect(diffSnapshot(next, EMPTY_SNAPSHOT).pairs).toEqual({ [key]: null });
  });

  it("validates what a browser sends: unknown fields, bad keys and invented cards are dropped", () => {
    const p = cleanPatch({
      pairs: {
        [key]: { decision: { status: "approved", reason: "r", at: "t", score: 99 }, slot: "10:00; DROP" },
        "not a key": { slot: "10:00" },
      },
      audit: [{ id: "A-1", at: "nope" }],
      needs: [{ id: "N-X" }],
      talent: [{ id: "T-YOU", createdByUser: true }],
    })!;
    expect(Object.keys(p.pairs)).toEqual([key]);
    expect(p.pairs[key]).toEqual({ decision: { status: "approved", reason: "r", at: "t" } });
    expect(p.audit).toEqual([]);
    expect(p.needs).toEqual([]);
    expect(p.talent).toHaveLength(1);
    expect(cleanPatch("x")).toBeNull();
  });
});
