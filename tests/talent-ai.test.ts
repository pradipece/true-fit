import { describe, expect, it } from "vitest";
import { rulesPrivacy, sanitizeEvidence, type EvidenceRequest } from "@/lib/talent-ai";

const req: EvidenceRequest = {
  picked: ["sql"],
  background: "",
  answers: [
    {
      id: "p1",
      kind: "scenario",
      label: "Answer 1",
      prompt: "Something broke",
      text: "I checked the import log first and wrote a SQL query to find the duplicated rows.",
    },
  ],
};

describe("evidence mapping guard", () => {
  it("drops mappings whose quote is not in the answer, unknown skills and duplicates", () => {
    const out = sanitizeEvidence(
      {
        mappings: [
          { answer_id: "p1", skill: "sql", quote: "wrote a SQL query", strength: "clear", why: "ok" },
          { answer_id: "p1", skill: "sql", quote: "wrote a SQL query", strength: "clear", why: "dup" },
          {
            answer_id: "p1",
            skill: "python",
            quote: "I built a Python pipeline",
            strength: "clear",
            why: "invented",
          },
          { answer_id: "p1", skill: "not-a-skill", quote: "import log", strength: "partial", why: "bad id" },
          { answer_id: "p9", skill: "analysis", quote: "import log", strength: "partial", why: "bad answer" },
        ],
        privacy_flags: [{ answer_id: "p1", text: "Helsinki University", kind: "school" }],
        headline: "Fixes data problems",
      },
      req,
    );
    expect(out.mappings).toHaveLength(1);
    expect(out.mappings[0]).toMatchObject({ skill: "sql", quote: "wrote a SQL query" });
    // A flag for text that isn't in the answer is dropped too.
    expect(out.flags).toHaveLength(0);
  });
});

describe("privacy check", () => {
  it("flags names, contacts, nationality, schools, age and family details", () => {
    const flags = rulesPrivacy([
      {
        id: "p1",
        text: "My name is Ahmed and I'm Syrian, 34 years old. I studied at Damascus University. My wife helped. ahmed@example.com",
      },
    ]);
    expect(new Set(flags.map((f) => f.kind))).toEqual(
      new Set(["name", "nationality", "age", "school", "family", "contact"]),
    );
  });

  it("does not flag languages or plain work descriptions", () => {
    expect(
      rulesPrivacy([
        {
          id: "p1",
          text: "I speak Finnish and English and ran the warehouse night shift for a school year.",
        },
      ]),
    ).toEqual([]);
  });
});
