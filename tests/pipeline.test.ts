import { describe, expect, it } from "vitest";
import { pairKey } from "@/lib/match";
import { activeKeys, myTurn, stageOf, visibleTo, type PipelineState } from "@/lib/pipeline";

const key = pairKey("N-01", "T-30");
const empty: PipelineState = { decisions: {}, optIns: {}, slots: {}, screening: {}, offers: {} };
const approved = { [key]: { status: "approved" as const, reason: "x", at: "" } };
const passed = { [key]: { answer: true, slot: "10:00", result: "passed" as const } };
const both = { [key]: { company: true, talent: true } };
const s = (x: Partial<PipelineState>) => ({ ...empty, ...x });

describe("recruitment pipeline", () => {
  it("walks apply → Espoo assessment → Espoo interview → company → interview → offer", () => {
    const steps: [Partial<PipelineState>, string, string | null][] = [
      [{ optIns: { [key]: { talent: true } } }, "applied", "organiser"],
      [{ decisions: approved }, "invited", "candidate"],
      [{ decisions: approved, screening: { [key]: { answer: true } } }, "screen-to-book", "candidate"],
      [
        { decisions: approved, screening: { [key]: { answer: true, slot: "10:00" } } },
        "screen-booked",
        "organiser",
      ],
      [{ decisions: approved, screening: passed }, "shared", "company"],
      [
        { decisions: approved, screening: passed, optIns: { [key]: { company: true } } },
        "interview-invited",
        "candidate",
      ],
      [{ decisions: approved, screening: passed, optIns: both }, "interview-to-book", "either"],
      [
        { decisions: approved, screening: passed, optIns: both, slots: { [key]: "10:30" } },
        "interview-booked",
        "company",
      ],
      [
        {
          decisions: approved,
          screening: passed,
          optIns: both,
          slots: { [key]: "10:30" },
          offers: { [key]: { status: "offered", at: "" } },
        },
        "offered",
        "candidate",
      ],
    ];
    steps.forEach(([state, stage, waiting], i) => {
      const p = stageOf(key, s(state));
      expect(p).toMatchObject({ stage, waiting, stopped: false });
      if (i > 0) expect(p.step).toBeGreaterThanOrEqual(stageOf(key, s(steps[i - 1][0])).step);
    });
    const hired = stageOf(
      key,
      s({
        decisions: approved,
        screening: passed,
        optIns: both,
        slots: { [key]: "10:30" },
        offers: { [key]: { status: "offered", at: "", answer: true } },
      }),
    );
    expect(hired).toMatchObject({ stage: "hired", hired: true, stopped: false });
  });

  it("stops without a hire at any human no", () => {
    expect(
      stageOf(key, s({ decisions: { [key]: { status: "rejected", reason: "x", at: "" } } })).stopped,
    ).toBe(true);
    expect(stageOf(key, s({ decisions: approved, screening: { [key]: { answer: false } } })).stage).toBe(
      "screen-declined",
    );
    expect(
      stageOf(key, s({ decisions: approved, screening: { [key]: { answer: true, result: "not-passed" } } }))
        .stage,
    ).toBe("not-passed");
    expect(
      stageOf(key, s({ decisions: approved, screening: passed, optIns: { [key]: { company: false } } }))
        .stage,
    ).toBe("company-passed");
  });

  it("shows the company nothing until the candidate passes the Espoo interview", () => {
    const asked = s({ optIns: { [key]: { company: true } } });
    expect(visibleTo("company", key, asked)).toBe(false);
    expect(visibleTo("talent", key, asked)).toBe(false);
    const invited = s({ decisions: approved, optIns: { [key]: { company: true } } });
    expect(visibleTo("company", key, invited)).toBe(false);
    expect(visibleTo("talent", key, invited)).toBe(true);
    expect(visibleTo("company", key, s({ decisions: approved, screening: passed }))).toBe(true);
  });

  it("lists every pair with a request or a decision, and whose move it is", () => {
    expect(activeKeys(s({ optIns: { a: { talent: true }, b: {} }, decisions: approved }))).toEqual([
      key,
      "a",
    ]);
    expect(myTurn("talent", stageOf(key, s({ decisions: approved })))).toBe(true);
    expect(myTurn("company", stageOf(key, s({ decisions: approved })))).toBe(false);
  });
});
