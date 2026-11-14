import { describe, expect, it } from "vitest";
import { hydrate } from "@/lib/store";
import { SEED } from "@/lib/seed";
import type { Talent } from "@/lib/types";

type State = Parameters<typeof hydrate>[0];

const initial = {
  needs: SEED.needs,
  talent: SEED.talent,
  decisions: {},
  audit: [],
  optIns: {},
} as unknown as State;

describe("persisted demo state", () => {
  it("keeps the server's seed talent over an older saved copy (no contact, short name)", () => {
    const stale = SEED.talent.map((t) => ({ ...t, contact: undefined, revealName: "Daniel F." }));
    const out = hydrate(initial, { talent: stale as Talent[] });
    expect(out.talent).toEqual(SEED.talent);
    expect(out.talent.every((t) => t.contact?.fullName)).toBe(true);
  });

  it("restores what the user created, first, and the rest of their saved state", () => {
    const mine = { ...SEED.talent[0], id: "T-USER", createdByUser: true } as Talent;
    const out = hydrate(initial, {
      talent: [mine, ...SEED.talent],
      optIns: { "N-01|T-01": { company: true } },
    });
    expect(out.talent[0]).toEqual(mine);
    expect(out.talent).toHaveLength(SEED.talent.length + 1);
    expect(out.optIns).toEqual({ "N-01|T-01": { company: true } });
    expect(out.needs).toEqual(SEED.needs);
  });
});
