import { describe, expect, it } from "vitest";
import { authorizePatch, type Who } from "@/lib/auth/patch-rbac";
import { cleanDraft } from "@/lib/candidate-profile";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import {
  applyPatch,
  cleanPatch,
  diffSnapshot,
  EMPTY_SNAPSHOT,
  fromSnapshot,
  stableJson,
  toSnapshot,
  type PipelineMaps,
  type Snapshot,
} from "@/lib/demo-state";
import { draftToNeed, missingFields, sanitizeDraft } from "@/lib/intake";
import { matchesForNeed, pairKey } from "@/lib/match";
import { myTurn, stageOf, stepState, STEPS, visibleTo, type Stage } from "@/lib/pipeline";
import { SLOT_TIMES } from "@/lib/schedule";

/**
 * The main flows end to end, through the same save path the app uses:
 * browser maps → toSnapshot → diffSnapshot → JSON → cleanPatch → authorizePatch → applyPatch.
 * At each step the right person's change is saved and everyone else's is refused.
 */

const need = SEED_NEEDS.find((n) => n.id === "N-01")!;
const candidate = SEED_TALENT.find((t) => t.id === "T-30")!;
const key = pairKey(need.id, candidate.id);
const otherCompanyId = SEED_NEEDS.find((n) => n.companyId !== need.companyId)!.companyId!;
const otherCandidateId = SEED_TALENT.find((t) => t.id !== candidate.id)!.id;
const seedTalentIds = SEED_TALENT.map((t) => t.id);

const organiser: Who = { role: "organiser", id: "ESPOO" };
const talent: Who = { role: "talent", id: candidate.id };
const company: Who = { role: "company", id: need.companyId! };
const strangerTalent: Who = { role: "talent", id: otherCandidateId };
const rivalCompany: Who = { role: "company", id: otherCompanyId };
const everyone = [organiser, talent, company, strangerTalent, rivalCompany];

const at = "2026-11-14T10:00:00.000Z";
const emptyMaps = (): PipelineMaps => ({
  decisions: {},
  optIns: {},
  slots: {},
  screening: {},
  offers: {},
  feedback: {},
  audit: [],
  needs: [],
  talent: [],
});

/** A tiny "server" that saves a browser's change only if the sender may make it. */
function server() {
  let saved: Snapshot = EMPTY_SNAPSHOT;
  return {
    get state() {
      return saved;
    },
    /** Try a change as `who`; returns the refusal reason or null when saved. */
    send(who: Who, next: PipelineMaps) {
      const wire = JSON.parse(JSON.stringify(diffSnapshot(saved, toSnapshot(next))));
      const patch = cleanPatch(wire);
      if (!patch) return "invalid";
      const problem = authorizePatch(patch, saved, who, SEED_NEEDS, seedTalentIds);
      if (!problem) saved = applyPatch(saved, patch);
      return problem;
    },
    stage() {
      const m = fromSnapshot(saved);
      return stageOf(key, m);
    },
  };
}

/** Apply one person's change: everyone not allowed is refused first, then the actor saves. */
function step(srv: ReturnType<typeof server>, actor: Who, maps: PipelineMaps, allowed: Who[] = [actor]) {
  for (const who of everyone.filter((w) => !allowed.includes(w)))
    expect(srv.send(who, maps), `${who.role} ${who.id} must be refused`).not.toBeNull();
  expect(srv.send(actor, maps)).toBeNull();
}

describe("main flow: candidate applies → hired", () => {
  it("moves through all six steps, each saved only by the person whose move it is", () => {
    const srv = server();
    const m = emptyMaps();
    const expectStage = (stage: Stage, waiting: string | null) =>
      expect(srv.stage()).toMatchObject({ stage, waiting });

    // 1. The candidate asks to meet.
    m.optIns[key] = { talent: true };
    step(srv, talent, m);
    expectStage("applied", "organiser");
    expect(visibleTo("company", key, fromSnapshot(srv.state))).toBe(false);

    // 2. Espoo invites the candidate to an Espoo interview, with a reason.
    m.decisions[key] = { status: "approved", reason: "Strong transferable skills", at };
    step(srv, organiser, m);
    expectStage("invited", "candidate");

    // 3. The candidate accepts and books; Espoo records a pass.
    m.screening[key] = { answer: true };
    step(srv, talent, m);
    expectStage("screen-to-book", "candidate");
    m.screening[key] = { answer: true, slot: SLOT_TIMES[0] };
    step(srv, talent, m, [talent, organiser]); // the Espoo desk may also move the slot
    expectStage("screen-booked", "organiser");
    m.screening[key] = { ...m.screening[key], result: "passed", reason: "Clear examples", at };
    step(srv, organiser, m);
    expectStage("shared", "company");

    // 4. Only now does the company see the profile; it invites to interview.
    expect(visibleTo("company", key, fromSnapshot(srv.state))).toBe(true);
    m.optIns[key] = { talent: true, company: true };
    step(srv, company, m);
    expectStage("interview-to-book", "either");

    // 5. Either side books the company interview, after the Espoo one.
    m.slots[key] = SLOT_TIMES[3];
    step(srv, company, m, [company, talent]);
    expectStage("interview-booked", "company");

    // 6. The company offers, the candidate accepts.
    m.offers[key] = { status: "offered", at };
    step(srv, company, m);
    expectStage("offered", "candidate");
    m.offers[key] = { ...m.offers[key], answer: true, answeredAt: at };
    step(srv, talent, m);
    expect(srv.stage()).toMatchObject({ stage: "hired", hired: true, stopped: false, waiting: null });
  });

  it("stores the same thing the browser holds (no drift after a round trip)", () => {
    const srv = server();
    const m = emptyMaps();
    m.optIns[key] = { company: true };
    expect(srv.send(company, m)).toBeNull();
    m.decisions[key] = { status: "approved", reason: "fit", at };
    expect(srv.send(organiser, m)).toBeNull();
    expect(stableJson(srv.state)).toBe(stableJson(toSnapshot(m)));
    // Saving again with nothing changed sends nothing and is always allowed.
    for (const who of everyone) expect(srv.send(who, m)).toBeNull();
  });
});

describe("main flow: the company asks first", () => {
  it("counts the company's request as its yes, and the candidate still has to say yes", () => {
    const srv = server();
    const m = emptyMaps();
    m.optIns[key] = { company: true };
    step(srv, company, m);
    expect(srv.stage()).toMatchObject({ stage: "applied", waiting: "organiser" });
    // The candidate doesn't see a company's request until Espoo invites them.
    expect(visibleTo("talent", key, fromSnapshot(srv.state))).toBe(false);
    m.decisions[key] = { status: "approved", reason: "fit", at };
    m.screening[key] = { answer: true, slot: SLOT_TIMES[0], result: "passed", reason: "ok", at };
    // Setting the candidate's answers on their behalf is refused for Espoo.
    expect(srv.send(organiser, m)).toMatch(/screening.answer/);
  });
});

describe("main flow: any human no stops the pair, and an undo reopens it", () => {
  it("lets the candidate decline the Espoo interview and nobody's move remains", () => {
    const srv = server();
    const m = emptyMaps();
    m.optIns[key] = { talent: true };
    m.decisions[key] = { status: "approved", reason: "fit", at };
    srv.send(talent, { ...m, decisions: {} });
    srv.send(organiser, m);
    m.screening[key] = { answer: false };
    step(srv, talent, m);
    const p = srv.stage();
    expect(p).toMatchObject({ stage: "screen-declined", stopped: true, waiting: null });
    expect(myTurn("talent", p) || myTurn("company", p)).toBe(false);
  });

  it("lets the organiser undo a decision, which puts the request back in the queue", () => {
    const srv = server();
    const m = emptyMaps();
    m.optIns[key] = { talent: true };
    srv.send(talent, m);
    m.decisions[key] = { status: "rejected", reason: "Not enough overlap yet", at };
    srv.send(organiser, m);
    expect(srv.stage()).toMatchObject({ stage: "not-selected", stopped: true });
    delete m.decisions[key];
    // Clearing is allowed for parties only: the candidate's own pair, or the organiser.
    expect(srv.send(strangerTalent, m)).toMatch(/Not your pair/);
    expect(srv.send(organiser, m)).toBeNull();
    expect(srv.stage()).toMatchObject({ stage: "applied", waiting: "organiser" });
  });

  it("lets the candidate withdraw an application on their own pair only", () => {
    const srv = server();
    const m = emptyMaps();
    m.optIns[key] = { talent: true };
    srv.send(talent, m);
    const withdrawn = emptyMaps();
    expect(srv.send(rivalCompany, withdrawn)).toMatch(/Not your pair/);
    expect(srv.send(talent, withdrawn)).toBeNull();
    expect(srv.stage().stage).toBe("none");
  });
});

describe("main flow: a new company posts a role and sees who fits", () => {
  it("turns a chat-built card into a saved role with suitable candidates", () => {
    const me: Who = { role: "company", id: "C-newco12345", name: "Newco Oy" };
    const draft = sanitizeDraft({
      title: "  Home care nurse ",
      must: need.must,
      nice: need.nice,
      language: "Finnish or English",
      mode: "On-site",
      timing: { start: "January", engagement: "Permanent" },
    });
    expect(missingFields(draft)).toEqual([]);
    const card = draftToNeed(draft, me.name!, { id: me.id });
    expect(card).toMatchObject({ title: "Home care nurse", companyId: me.id, company: "Newco Oy" });

    const srv = server();
    const maps = { ...emptyMaps(), needs: [card] };
    expect(srv.send(rivalCompany, maps)).not.toBeNull();
    expect(srv.send({ ...me, name: "Someone Else Oy" }, maps)).toMatch(/own company name/);
    expect(srv.send(me, maps)).toBeNull();
    expect(srv.state.needs.map((n) => n.id)).toEqual([card.id]);

    const matches = matchesForNeed(card, SEED_TALENT);
    // Nobody is hidden: everyone is listed, and some are suggested.
    expect(matches).toHaveLength(SEED_TALENT.length);
    expect(matches.some((x) => x.suggested)).toBe(true);
    // Best skill match first.
    const scores = matches.map((x) => x.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe("main flow: a job seeker builds a profile and comes back later", () => {
  it("restores exactly what they saved, after the server cleaned it", () => {
    const saved = cleanDraft(
      JSON.parse(
        JSON.stringify({
          step: 2,
          title: "Warehouse lead",
          path: "Five years running a night shift.",
          skills: candidate.skills.slice(0, 3),
          answers: { p1: "I re-planned the picking routes and we finished an hour earlier." },
          languages: ["English"],
          mode: "On-site",
          contact: { fullName: "Sam", email: "sam@example.com", phone: "", city: "Espoo" },
        }),
      ),
    )!;
    const again = cleanDraft(JSON.parse(JSON.stringify(saved)));
    expect(again).toEqual(saved);
    expect(saved.step).toBe(2);
  });
});

describe("stepper shown on every pair", () => {
  const stages: [Partial<Parameters<typeof stageOf>[1]>, Stage][] = [
    [{ optIns: { [key]: { talent: true } } }, "applied"],
    [{ decisions: { [key]: { status: "approved", reason: "x", at } } }, "invited"],
    [
      {
        decisions: { [key]: { status: "approved", reason: "x", at } },
        screening: { [key]: { answer: true, result: "passed" } },
        optIns: { [key]: { company: true, talent: true } },
        slots: { [key]: SLOT_TIMES[1] },
        offers: { [key]: { status: "offered", at, answer: true } },
      },
      "hired",
    ],
  ];

  it("marks earlier steps done, the current one current, later ones to do", () => {
    for (const [s, stage] of stages) {
      const p = stageOf(key, { decisions: {}, optIns: {}, slots: {}, screening: {}, offers: {}, ...s });
      expect(p.stage).toBe(stage);
      const states = STEPS.map((_, i) => stepState(p, i));
      expect(states.slice(0, p.step).every((x) => x === "done")).toBe(true);
      expect(states.slice(p.step + 1).every((x) => x === "todo")).toBe(true);
      expect(states[p.step]).toBe(p.hired ? "done" : "current");
    }
  });

  it("shows a stopped pair as stopped at the step where it ended", () => {
    const p = stageOf(key, {
      decisions: { [key]: { status: "rejected", reason: "x", at } },
      optIns: {},
      slots: {},
      screening: {},
      offers: {},
    });
    expect(stepState(p, p.step)).toBe("stopped");
    expect(STEPS[p.step].id).toBe("assess");
  });
});
