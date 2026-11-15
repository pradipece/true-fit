import { describe, expect, it } from "vitest";
import { cleanSignUp } from "@/lib/auth/job-seekers";
import { cleanDraft, MAX_DRAFT } from "@/lib/candidate-profile";
import { cleanContact, contactProblem } from "@/lib/contact";
import { cleanAudit, cleanPatch, cleanRow } from "@/lib/demo-state";
import { feedbackError } from "@/lib/impact";
import {
  cleanQuickReplies,
  draftToNeed,
  EMPTY_DRAFT,
  FREE_TEXT_MAX,
  LANGUAGE_REPLIES,
  missingFields,
  QUICK_REPLY_MAX,
  sanitizeDraft,
  withLanguageReplies,
} from "@/lib/intake";
import { SKILLS } from "@/lib/esco";
import { rulesPrivacy, sanitizeEvidence, type EvidenceRequest } from "@/lib/talent-ai";

/**
 * What people type (or what a hand-made request sends) is cleaned before it is saved or
 * shown: these tests throw malformed, oversized and hostile input at every validator.
 */

const KEY = "N-01::T-30";
const skill = (i: number) => SKILLS[i].id;

// ── Sign-up form ─────────────────────────────────────────────────────────────

describe("sign-up form (name + email)", () => {
  it("rejects malformed emails with a friendly message", () => {
    for (const email of [
      "",
      "   ",
      "plain",
      "a@b",
      "a@@b.com",
      "a b@c.com",
      "@example.com",
      "a@.com",
      "a@b.c",
    ])
      expect(cleanSignUp("Aino", email), email).toEqual({ error: "Enter a valid email address." });
  });

  it("copes with missing or non-string values instead of crashing", () => {
    expect(cleanSignUp(undefined, undefined)).toHaveProperty("error");
    expect(cleanSignUp(null, 42)).toHaveProperty("error");
    expect(cleanSignUp(undefined, "a@example.com")).toEqual({ name: "", email: "a@example.com" });
  });

  it("collapses whitespace, caps the name at 80 characters and lowercases the email", () => {
    const r = cleanSignUp(`  Aino\n\t${"x".repeat(200)}  `, "  AINO@Example.FI ") as {
      name: string;
      email: string;
    };
    expect(r.email).toBe("aino@example.fi");
    expect(r.name).toHaveLength(80);
    expect(r.name).not.toMatch(/\s{2,}|\n|\t/);
  });

  it("treats a whitespace-only name as no name (new accounts then ask for one)", () => {
    expect(cleanSignUp("   \n ", "a@example.com")).toEqual({ name: "", email: "a@example.com" });
  });

  it("accepts international addresses and keeps markup as plain text", () => {
    expect(cleanSignUp("Åsa", "åsa@exämple.fi")).toMatchObject({ email: "åsa@exämple.fi" });
    expect(cleanSignUp("<script>alert(1)</script>", "x@example.com")).toMatchObject({
      name: "<script>alert(1)</script>",
    });
  });
});

// ── Personal details on the profile ──────────────────────────────────────────

describe("personal details (name, email, phone)", () => {
  const ok = { fullName: "Alex Virtanen", email: "alex@example.com", phone: "", city: "" };

  it("asks for the name first, then the email", () => {
    expect(contactProblem({ ...ok, fullName: "   " })).toBe("Add your full name.");
    expect(contactProblem({ ...ok, fullName: "", email: "" })).toBe("Add your full name.");
    expect(contactProblem({ ...ok, email: "alex@example" })).toBe("Add a valid email address.");
    expect(contactProblem({ ...ok, email: " alex@example.com " })).toBe("");
  });

  it("accepts common Finnish and international phone formats", () => {
    for (const phone of ["040 123 4567", "+358 40 123 4567", "+358-40-1234567", "(09) 816 21", "0401234567"])
      expect(contactProblem({ ...ok, phone }), phone).toBe("");
  });

  it("rejects phone numbers that are too short, too long or not numbers", () => {
    for (const phone of ["12345", "+", "call me", "040 123 4567 ext 2", "1".repeat(21)])
      expect(contactProblem({ ...ok, phone }), phone).toBe("Check your phone number.");
  });

  // Known gap: the pattern accepts any 6–20 of "digits, spaces, ( ) -", so a phone
  // number with no digits at all passes. Fails until PHONE_RE requires digits.
  it("rejects a phone number with no digits", () => {
    for (const phone of ["------", "( ) ( )", "- - - -"])
      expect(contactProblem({ ...ok, phone }), phone).toBe("Check your phone number.");
  });

  it("never saves leading or doubled whitespace", () => {
    expect(
      cleanContact({ fullName: "\tAlex \n Virtanen", email: "A@B.FI", phone: " 040 ", city: "  " }),
    ).toEqual({ fullName: "Alex Virtanen", email: "a@b.fi", phone: "040", city: "" });
  });
});

// ── Saved job-seeker profile (server side) ───────────────────────────────────

describe("saved profile draft from a browser", () => {
  it("refuses anything that isn't a profile object, or is too large", () => {
    for (const v of [null, undefined, "x", 42, [], [{}], true]) expect(cleanDraft(v)).toBeNull();
    expect(cleanDraft({ path: "x".repeat(MAX_DRAFT + 1) })).toBeNull();
  });

  it("fills safe defaults for an empty object", () => {
    expect(cleanDraft({})).toMatchObject({
      step: 0,
      title: "",
      skills: [],
      answers: {},
      mode: "Any",
      reviewed: false,
      contact: { fullName: "", email: "", phone: "", city: "" },
      translation: null,
      sample: null,
      result: null,
    });
  });

  it("keeps the step within the four steps of the builder", () => {
    expect(cleanDraft({ step: 2.7 })!.step).toBe(2);
    for (const step of [-1, 4, 99, Number.NaN, Number.POSITIVE_INFINITY, "2", null])
      expect(cleanDraft({ step })!.step, String(step)).toBe(0);
  });

  it("drops wrong types and caps list sizes and lengths", () => {
    const d = cleanDraft({
      title: 123,
      skills: [...Array.from({ length: 30 }, (_, i) => `s${i}`), 7, null, "y".repeat(100)],
      languages: Array.from({ length: 20 }, () => "Finnish"),
      mode: "Moon base",
      reviewed: "yes",
      contact: "alex@example.com",
      headline: "h".repeat(500),
    })!;
    expect(d.title).toBe("");
    expect(d.skills).toHaveLength(20);
    expect(d.skills.every((s) => typeof s === "string" && s.length <= 64)).toBe(true);
    expect(d.languages).toHaveLength(12);
    expect(d.mode).toBe("Any");
    expect(d.reviewed).toBe(false);
    expect(d.contact).toEqual({ fullName: "", email: "", phone: "", city: "" });
    expect(d.headline).toHaveLength(200);
  });

  it("keeps at most 20 answers, short keys and only text values", () => {
    const answers = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, `answer ${i}`]));
    const d = cleanDraft({ answers: { ...answers, ["long".repeat(30)]: "x", num: 5 } })!;
    expect(Object.keys(d.answers).length).toBeLessThanOrEqual(20);
    expect(Object.keys(d.answers).every((k) => k.length <= 40)).toBe(true);
    expect(Object.values(d.answers).every((a) => typeof a === "string")).toBe(true);
    expect(cleanDraft({ answers: { p1: "z".repeat(10_000) } })!.answers.p1).toHaveLength(4000);
  });

  it("can't be used to pollute object prototypes", () => {
    const hostile = JSON.parse(
      '{"answers":{"__proto__":{"polluted":"yes"},"p1":"ok"},"contact":{"__proto__":{"x":1}}}',
    );
    const d = cleanDraft(hostile)!;
    expect(d.answers).toEqual({ p1: "ok" });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it("round-trips what a person typed unchanged", () => {
    const typed = {
      step: 3,
      title: "Lähihoitaja",
      path: "Seven years in home care in Tampere, then a nursing course.",
      skills: [skill(0), skill(1)],
      answers: { p1: "I planned visits for 12 clients a day." },
      headline: "Calm under pressure",
      languages: ["Finnish", "English"],
      mode: "Hybrid",
      availability: "From January",
      contact: { fullName: "Alex", email: "alex@example.com", phone: "040 123 4567", city: "Espoo" },
      reviewed: true,
    };
    expect(cleanDraft(JSON.parse(JSON.stringify(typed)))).toMatchObject(typed);
  });
});

// ── Need card (company intake) ───────────────────────────────────────────────

describe("need card fields", () => {
  it("keeps only known skills, once, and never in both must and nice", () => {
    const d = sanitizeDraft({
      must: [skill(0), skill(0), "invented-skill", skill(1)],
      nice: [skill(1), skill(2), "nope"],
    });
    expect(d.must).toEqual([skill(0), skill(1)]);
    expect(d.nice).toEqual([skill(2)]);
  });

  it("allows free wording for language, way of working and contract, on one short line", () => {
    const d = sanitizeDraft({
      language: "  Finnish\nor   Swedish ",
      mode: "Two days in Otaniemi, rest remote",
      timing: { start: "ASAP\t", engagement: "x".repeat(200) },
    });
    expect(d.language).toBe("Finnish or Swedish");
    expect(d.mode).toBe("Two days in Otaniemi, rest remote");
    expect(d.timing.start).toBe("ASAP");
    expect(d.timing.engagement).toHaveLength(FREE_TEXT_MAX);
  });

  it("caps title and summary, drops unknown occupations and non-text values", () => {
    const d = sanitizeDraft({
      title: ` ${"T".repeat(200)} `,
      summary: "s".repeat(1000),
      occupation: "not-an-occupation",
      language: 42 as unknown as string,
    });
    expect(d.title).toHaveLength(80);
    expect(d.summary).toHaveLength(400);
    expect(d.occupation).toBe("");
    expect(d.language).toBe("");
  });

  it("tells the company what's still missing, in a stable order", () => {
    expect(missingFields(EMPTY_DRAFT)).toEqual([
      "role",
      "must-have skills",
      "language",
      "timing",
      "way of working",
    ]);
    const done = sanitizeDraft({
      title: "Nurse",
      must: [skill(0)],
      language: "Finnish",
      mode: "On-site",
      timing: { start: "March", engagement: "" },
    });
    expect(missingFields(done)).toEqual([]);
  });

  it("fills sensible defaults when an unfinished card is turned into a role", () => {
    const n = draftToNeed(EMPTY_DRAFT, "   ", { id: "C-aaaaaaaaaa" });
    expect(n).toMatchObject({
      id: "N-C-aaaaaaaaaa-NEW",
      title: "New role",
      language: "English OK",
      mode: "Hybrid",
      timing: undefined,
      createdByUser: true,
    });
    expect(n.company.length).toBeGreaterThan(0);
  });
});

describe("chat suggested answers", () => {
  it("strips curly and guillemet quotes and collapses inner whitespace", () => {
    expect(cleanQuickReplies(["“Hybrid   works”", "«Remote»", "'On-site'"])).toEqual([
      "Hybrid works",
      "Remote",
      "On-site",
    ]);
  });

  it("keeps a reply of exactly the maximum length and drops one character more", () => {
    const max = "a".repeat(QUICK_REPLY_MAX);
    expect(cleanQuickReplies([max, `${max}b`])).toEqual([max]);
  });

  it("drops punctuation-only replies and echoes of the last message ignoring punctuation", () => {
    expect(cleanQuickReplies(["...", "!!", "We need a dev!", "Back-end"], "we need a dev")).toEqual([
      "Back-end",
    ]);
  });

  it("offers the language options only while the card has no language", () => {
    const own = ["Yes", "No"];
    expect(withLanguageReplies("Which working language do you use?", "", own)).toEqual(LANGUAGE_REPLIES);
    expect(withLanguageReplies("Mikä on työkieli?", " ", own)).toEqual(LANGUAGE_REPLIES);
    expect(withLanguageReplies("Vilket språk talar ni?", "", own)).toEqual(LANGUAGE_REPLIES);
    expect(withLanguageReplies("Which working language do you use?", "Finnish", own)).toBe(own);
    expect(withLanguageReplies("When should they start?", "", own)).toBe(own);
  });
});

// ── AI output about a person's answers ───────────────────────────────────────

describe("evidence from scenario answers", () => {
  const req: EvidenceRequest = {
    answers: [
      { id: "p1", prompt: "q", text: "I planned home visits for twelve clients every day." },
      { id: "p2", prompt: "q", text: "I trained two new colleagues on the booking system." },
    ] as EvidenceRequest["answers"],
    picked: [],
    background: "",
  };
  const m = (answer_id: string, s: string, quote: string, strength: "clear" | "partial" = "clear") => ({
    answer_id,
    skill: s,
    quote,
    strength,
    why: "w".repeat(500),
  });

  it("keeps only quotes that really appear in that answer, for known skills, once", () => {
    const out = sanitizeEvidence(
      {
        mappings: [
          m("p1", skill(0), "planned home visits"),
          m("p1", skill(0), "twelve clients"), // same answer + skill again
          m("p1", skill(1), "managed a hospital"), // invented quote
          m("p2", skill(1), "planned home visits"), // quote from another answer
          m("p9", skill(1), "trained"), // unknown answer
          m("p2", "invented-skill", "trained two"), // unknown skill
          m("p2", skill(2), "  trained two new colleagues  ", "partial"),
        ],
        privacy_flags: [],
        headline: "H".repeat(200),
      },
      req,
    );
    expect(out.mappings.map((x) => [x.answerId, x.skill, x.quote])).toEqual([
      ["p1", skill(0), "planned home visits"],
      ["p2", skill(2), "trained two new colleagues"],
    ]);
    expect(out.mappings.every((x) => x.why.length <= 200)).toBe(true);
    expect(out.headline.length).toBeLessThanOrEqual(90);
  });

  it("copes with a model reply that has missing lists", () => {
    const out = sanitizeEvidence({} as never, req);
    expect(out).toEqual({ mappings: [], flags: [], headline: "" });
  });

  it("drops invented privacy flags but always adds what the rules find", () => {
    const r: EvidenceRequest = {
      ...req,
      answers: [
        { id: "p1", prompt: "q", text: "Email me at alex@example.com about the job." },
      ] as EvidenceRequest["answers"],
    };
    const out = sanitizeEvidence(
      { mappings: [], privacy_flags: [{ answer_id: "p1", text: "born in 1980", kind: "age" }], headline: "" },
      r,
    );
    expect(out.flags.map((f) => [f.kind, f.text])).toEqual([["contact", "alex@example.com"]]);
  });
});

describe("privacy check on free text", () => {
  const flags = (text: string) => rulesPrivacy([{ id: "p1", text }]).map((f) => f.kind);

  it("spots personal details people shouldn't put on an anonymised card", () => {
    expect(flags("Call +358 40 123 4567 or mail a.b@example.fi")).toEqual(["contact", "contact"]);
    expect(flags("My name is Aino and I like logistics")).toContain("name");
    expect(flags("I am 45 years old")).toContain("age");
    expect(flags("I'm Syrian and moved here in 2019")).toContain("nationality");
    expect(flags("I studied at Aalto University")).toContain("school");
    expect(flags("I took maternity leave last year")).toContain("family");
  });

  it("doesn't flag ordinary work stories (fewer false alarms)", () => {
    expect(flags("I built a Python pipeline for invoices and led a team of 4 in Espoo.")).toEqual([]);
    expect(flags("I handled 25 customers a day and cut waiting times by 10 minutes.")).toEqual([]);
  });
});

// ── Pipeline rows sent to the server ─────────────────────────────────────────

describe("pipeline row from a browser", () => {
  it("rejects oversized rows and keeps only known fields", () => {
    expect(cleanRow({ decision: { status: "approved", reason: "x".repeat(9000), at: "" } })).toBeUndefined();
    expect(cleanRow({ hacked: true, optIn: { company: "yes", talent: true, admin: true } })).toEqual({
      optIn: { talent: true },
    });
  });

  it("drops unknown statuses and over-long reasons", () => {
    expect(cleanRow({ decision: { status: "hired", reason: "x", at: "" } })).toEqual({});
    expect(cleanRow({ decision: { status: "approved", reason: "r".repeat(501), at: "" } })).toEqual({
      decision: { status: "approved", reason: "", at: "" },
    });
    expect(cleanRow({ offer: { status: "maybe", at: "" } })).toEqual({});
    expect(cleanRow({ screening: { result: "great" } })).toEqual({});
  });

  it("accepts interview times in the event's format only", () => {
    expect(cleanRow({ slot: "2026-11-20 10:30" })).toEqual({ slot: "2026-11-20 10:30" });
    expect(cleanRow({ slot: "10:30" })).toEqual({ slot: "10:30" });
    for (const slot of ["10.30", "tomorrow", "10:30; DROP TABLE", " 10:30", 1030])
      expect(cleanRow({ slot })).toEqual({});
  });

  // Known gap: TIME only checks the shape, so impossible times are stored and shown.
  it("rejects impossible times", () => {
    for (const slot of ["99:99", "24:00", "10:61", "2026-13-45 10:30"])
      expect(cleanRow({ slot }), slot).toEqual({});
  });

  // Known gap: ratings are 1–5 in the form, but the server keeps any number, which would
  // skew the averages on the Insights page.
  it("keeps feedback ratings within 1–5", () => {
    const r = cleanRow({
      feedback: { company: { held: true, usefulness: 999, accuracy: -3, nextStep: "continue" } },
    });
    expect(r?.feedback?.company?.usefulness).toBeUndefined();
    expect(r?.feedback?.company?.accuracy).toBeUndefined();
  });

  it("drops unknown next steps and non-finite ratings", () => {
    const r = cleanRow({
      feedback: {
        talent: {
          held: true,
          usefulness: Number.NaN,
          accuracy: 4,
          nextStep: "marry",
          improve: "i".repeat(2000),
        },
      },
    });
    expect(r).toEqual({ feedback: { talent: { held: true, accuracy: 4, at: "" } } });
  });
});

describe("whole patch from a browser", () => {
  it("rejects malformed pair keys, including path tricks and extra parts", () => {
    const p = cleanPatch({
      pairs: Object.fromEntries(
        ["N-01::T-30::x", "../N-01::T-30", "N-01:T-30", "::T-30", "N-01::", "N 01::T-30", KEY].map((k) => [
          k,
          { optIn: { talent: true } },
        ]),
      ),
    })!;
    expect(Object.keys(p.pairs)).toEqual([KEY]);
  });

  it("turns an emptied row into a delete, and refuses floods", () => {
    expect(cleanPatch({ pairs: { [KEY]: { junk: 1 } } })!.pairs).toEqual({ [KEY]: null });
    const flood = Object.fromEntries(Array.from({ length: 2001 }, (_, i) => [`N-${i}::T-1`, null]));
    expect(cleanPatch({ pairs: flood })).toBeNull();
  });

  it("only accepts cards marked as made in the demo, with a safe id", () => {
    const p = cleanPatch({
      needs: [
        { id: "N-ok", createdByUser: true },
        { id: "N-seed" },
        { id: "N bad id", createdByUser: true },
        { id: "N-big", createdByUser: true, summary: "x".repeat(70_000) },
      ],
    })!;
    expect(p.needs.map((n) => n.id)).toEqual(["N-ok"]);
  });

  it("only keeps log entries with a real date, a known action and a reason", () => {
    const entry = {
      id: "A-1",
      at: "2026-11-14T10:00:00.000Z",
      actor: "Organiser (demo)",
      action: "approved",
      needId: "N-01",
      talentId: "T-30",
      from: "none",
      to: "approved",
      reason: "Strong skills",
    };
    expect(cleanAudit(entry)).toMatchObject({ id: "A-1" });
    expect(cleanAudit({ ...entry, reason: undefined })).toBeUndefined();
    expect(cleanAudit({ ...entry, at: "yesterday" })).toBeUndefined();
    expect(cleanAudit({ ...entry, action: "deleted" })).toBeUndefined();
    expect(cleanAudit({ ...entry, to: "hired" })).toBeUndefined();
    expect(cleanAudit({ ...entry, actor: "" })).toBeUndefined();
  });
});

describe("meeting feedback form", () => {
  it("asks for one missing answer at a time, in order", () => {
    expect(feedbackError({})).toMatch(/happened/);
    expect(feedbackError({ held: false })).toBeNull();
    expect(feedbackError({ held: true })).toMatch(/worth/);
    expect(feedbackError({ held: true, usefulness: 4 })).toMatch(/card/);
    expect(feedbackError({ held: true, usefulness: 4, accuracy: 5 })).toMatch(/next step/);
    expect(feedbackError({ held: true, usefulness: 4, accuracy: 5, nextStep: "continue" })).toBeNull();
  });
});
