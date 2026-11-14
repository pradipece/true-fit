import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { pairKey } from "@/lib/match";
import {
  eventSnapshot,
  rulesReply,
  sanitizeReply,
  sanitizeSnapshot,
  STARTERS,
} from "@/lib/organiser-assistant";

const state = {
  needs: SEED_NEEDS,
  talent: SEED_TALENT,
  decisions: {
    [pairKey(SEED_NEEDS[0].id, SEED_TALENT[0].id)]: {
      status: "approved" as const,
      reason: "r",
      at: "2026-11-10T00:00:00Z",
    },
  },
  optIns: {
    [pairKey(SEED_NEEDS[0].id, SEED_TALENT[0].id)]: { talent: true },
    [pairKey(SEED_NEEDS[1].id, SEED_TALENT[1].id)]: { company: true },
  },
  slots: {},
  feedback: {},
};

describe("eventSnapshot", () => {
  const snap = eventSnapshot(state);

  it("holds counts only, never anything about an individual", () => {
    const json = JSON.stringify(snap);
    for (const t of SEED_TALENT) {
      expect(json).not.toContain(t.id);
      expect(json).not.toContain(t.alias);
      if (t.revealName) expect(json).not.toContain(t.revealName);
      if (t.contact) expect(json).not.toContain(t.contact.email);
    }
  });

  it("counts introductions and open requests", () => {
    expect(snap.people).toBe(SEED_TALENT.length);
    expect(snap.needs).toHaveLength(SEED_NEEDS.length);
    expect(snap.introductions.total).toBe(1);
    expect(snap.introductions.waitingForCompany).toBe(1);
    expect(snap.needs[1].companyRequests).toBe(1);
    expect(snap.needs[0].candidateRequests).toBe(0); // already introduced, so not an open request
  });
});

describe("sanitizeSnapshot", () => {
  it("drops unknown fields and clamps numbers", () => {
    const s = sanitizeSnapshot({
      people: -5,
      needs: [{ title: "x".repeat(500), company: "Co", suggested: 1e9, name: "Leaked Person" }],
      fairness: [{ dimension: "Origin", ratio: 3 }],
      email: "a@b.c",
    })!;
    expect(s.people).toBe(0);
    expect(s.needs[0].title).toHaveLength(80);
    expect(s.needs[0].suggested).toBe(10_000);
    expect(s.fairness[0]).toEqual({ dimension: "Origin", ratio: 1, ok: true });
    expect(JSON.stringify(s)).not.toContain("Leaked");
    expect(JSON.stringify(s)).not.toContain("a@b.c");
  });

  it("rejects a missing snapshot", () => {
    expect(sanitizeSnapshot(null)).toBeNull();
  });
});

describe("sanitizeReply", () => {
  it("keeps only known links and short suggestions", () => {
    const r = sanitizeReply({
      reply: " Hi ",
      links: ["review", "evil" as never, "review"],
      suggestions: ["a", "", "b"],
    });
    expect(r).toEqual({ reply: "Hi", links: ["review"], suggestions: ["a", "b"] });
    expect(sanitizeReply({ reply: "  " })).toBeNull();
  });
});

describe("rulesReply", () => {
  const snap = eventSnapshot(state);
  it("answers every starter question from the snapshot", () => {
    for (const q of STARTERS) {
      const r = rulesReply(q, snap);
      expect(r.reply.length).toBeGreaterThan(10);
      expect(r.reply).not.toMatch(/undefined|NaN/);
    }
  });

  it("lists open requests by company need", () => {
    expect(rulesReply("Any open requests?", snap).reply).toContain(SEED_NEEDS[1].title);
  });
});
