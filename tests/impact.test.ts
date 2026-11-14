import { describe, expect, it } from "vitest";
import { anonymise, feedbackError, impactMetrics, pairOutcome } from "@/lib/impact";
import type { SideFeedback } from "@/lib/types";

const yes = (p: Partial<SideFeedback> = {}): SideFeedback => ({
  held: true,
  usefulness: 4,
  accuracy: 4,
  nextStep: "continue",
  at: "2026-12-03T11:00:00.000Z",
  ...p,
});
const no: SideFeedback = { held: false, at: "2026-12-03T11:00:00.000Z" };

describe("feedback form rules", () => {
  it("requires every structured answer when the meeting happened", () => {
    expect(feedbackError({})).toMatch(/happened/);
    expect(feedbackError({ held: false })).toBeNull();
    expect(feedbackError({ held: true })).toMatch(/worth/);
    expect(feedbackError({ held: true, usefulness: 3 })).toMatch(/card/);
    expect(feedbackError({ held: true, usefulness: 3, accuracy: 4 })).toMatch(/next step/);
    expect(feedbackError(yes())).toBeNull();
  });
});

describe("meeting outcome needs both sides", () => {
  it("is an interview only when both want to continue", () => {
    expect(pairOutcome({ company: yes(), talent: yes() })).toBe("interview");
    expect(pairOutcome({ company: yes(), talent: yes({ nextStep: "keep-in-touch" }) })).toBe("follow-up");
    expect(pairOutcome({ company: yes(), talent: yes({ nextStep: "stop" }) })).toBe("no-follow-up");
  });

  it("waits for the second answer and spots no-shows", () => {
    expect(pairOutcome(undefined)).toBe("awaiting");
    expect(pairOutcome({ company: yes() })).toBe("awaiting");
    expect(pairOutcome({ company: no })).toBe("no-show");
    expect(pairOutcome({ company: no, talent: no })).toBe("no-show");
  });
});

describe("impact metrics", () => {
  const slots = { a: "10:00", b: "10:10", c: "10:20", d: "10:30" };
  const feedback = {
    a: { company: yes({ usefulness: 5, accuracy: 4 }), talent: yes({ usefulness: 4, accuracy: 5 }) },
    b: {
      company: yes({ nextStep: "keep-in-touch", usefulness: 3, accuracy: 2 }),
      talent: yes({ nextStep: "keep-in-touch", usefulness: 2 }),
    },
    c: { company: no, talent: no },
  };

  it("counts meetings held, no-shows, follow-ups and interviews", () => {
    const i = impactMetrics(slots, feedback);
    expect(i).toMatchObject({ booked: 4, answered: 3, held: 2, noShows: 1, followUps: 2, interviews: 1 });
    expect(i.responseRate).toBe(1);
  });

  it("averages satisfaction and card accuracy per side over held meetings only", () => {
    const i = impactMetrics(slots, feedback);
    expect(i.satisfaction.company).toBe(4);
    expect(i.satisfaction.talent).toBe(3);
    expect(i.accuracy.skillCards).toBe(3);
    expect(i.accuracy.needCards).toBe(4.5);
  });

  it("is empty-safe before the event", () => {
    const i = impactMetrics({}, {});
    expect(i).toMatchObject({ booked: 0, held: 0, responseRate: null });
    expect(i.satisfaction.company).toBeNull();
  });

  it("removes identifying details from improvement ideas", () => {
    expect(anonymise("My name is Ahmed, email ahmed@example.com. Louder mics please.")).not.toMatch(
      /Ahmed|example\.com/,
    );
    const i = impactMetrics(
      { a: "10:00" },
      { a: { company: yes({ improve: "Contact me at boss@kivi.fi about rooms" }) } },
    );
    expect(i.ideas[0].text).toBe("Contact me at [removed] about rooms");
  });
});
