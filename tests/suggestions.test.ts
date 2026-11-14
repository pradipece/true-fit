import { describe, expect, it } from "vitest";
import { SEED_TALENT } from "@/lib/data";
import {
  EMPTY_DRAFT,
  languageCount,
  poolCount,
  quickReplyHint,
  relevantCount,
  rulesTurn,
  type NeedDraft,
} from "@/lib/intake";
import { rulesStarters, sanitizeStarters, STARTER_PROMPT_IDS } from "@/lib/talent-ai";
import type { Talent } from "@/lib/types";

const turn = (text: string, pool: Talent[] = SEED_TALENT) =>
  rulesTurn({ messages: [{ role: "user", content: text }], draft: EMPTY_DRAFT, asked: [] }, pool);

describe("intake quick replies follow the pool", () => {
  it("ranks dev areas by how many people in the pool have those skills", () => {
    const { quickReplies } = turn("We need a dev");
    expect(quickReplies[0]).toBe("Data & pipelines (Python, SQL)");
    const counts = quickReplies.map((q) =>
      Number(quickReplyHint(q, EMPTY_DRAFT, SEED_TALENT)?.split(" ")[0]),
    );
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(counts.every((n) => n > 0)).toBe(true);
  });

  it("never offers an area nobody in the pool covers", () => {
    const careOnly = SEED_TALENT.filter((t) => t.skills.some((s) => s.id === "patient-care"));
    const { quickReplies } = turn("We need someone", careOnly);
    expect(quickReplies).toContain("Patient or elderly care");
    for (const q of quickReplies) expect(quickReplyHint(q, EMPTY_DRAFT, careOnly)).not.toMatch(/^0 /);
  });

  it("hints report the same numbers as the matching rules", () => {
    const d: NeedDraft = { ...EMPTY_DRAFT, title: "Data", must: ["python", "sql"], nice: ["analysis"] };
    expect(quickReplyHint("Looks right", d, SEED_TALENT)).toBe(
      `${relevantCount(d, SEED_TALENT)} relevant now`,
    );
    const added = { ...d, must: [...d.must, "analysis"], nice: [] };
    expect(quickReplyHint("Data analysis is also a must", d, SEED_TALENT)).toBe(
      `${relevantCount(added, SEED_TALENT)} relevant (now ${relevantCount(d, SEED_TALENT)})`,
    );
    expect(quickReplyHint("Finnish required from day one", d, SEED_TALENT)).toBe(
      `${languageCount("Finnish required", SEED_TALENT)} of ${SEED_TALENT.length} can work in it`,
    );
    expect(quickReplyHint("Also cloud platforms", d, SEED_TALENT)).toBe(
      `${poolCount(["cloud"], SEED_TALENT)} in the pool`,
    );
  });

  it("can demote a must-have to nice-to-have, but never the last one", () => {
    const d: NeedDraft = { ...EMPTY_DRAFT, title: "Data", must: ["python", "sql"], nice: [] };
    const req = (text: string, draft: NeedDraft) =>
      rulesTurn(
        { messages: [{ role: "user", content: text }], draft, asked: ["area", "tasks", "must"] },
        SEED_TALENT,
      );
    const one = req("Make SQL / querying databases nice-to-have", d).draft;
    expect(one.must).toEqual(["python"]);
    expect(one.nice).toContain("sql");
    expect(req("Make Python programming nice-to-have", one).draft.must).toEqual(["python"]);
  });
});

describe("writing ideas follow the person's skills", () => {
  it("uses the area of the picked skills and names their top skill", () => {
    const care = rulesStarters({ picked: ["patient-care", "medication", "team"], background: "", path: "" });
    expect(care.p1.starter.toLowerCase()).toContain("patient");
    const data = rulesStarters({ picked: ["sql", "python"], background: "", path: "" });
    expect(data.p2.starter).toContain("sql / querying databases");
    expect(data.p1.starter).not.toEqual(care.p1.starter);
  });

  it("adds an idea from the translated background", () => {
    const s = rulesStarters({
      picked: ["warehouse"],
      background: "Varastopäällikkö · Warehouse manager",
      path: "",
    });
    expect(s.p1.ideas[0]).toBe("Something from your time as a warehouse manager");
  });

  it("starters are openings, never full answers", () => {
    const s = rulesStarters({ picked: ["energy"], background: "", path: "" });
    for (const id of STARTER_PROMPT_IDS) {
      expect(s[id].starter.length).toBeLessThan(100);
      expect(s[id].starter).not.toMatch(/[.!?]$/);
      expect(s[id].ideas.length).toBeGreaterThanOrEqual(2);
    }
    const cleaned = sanitizeStarters(
      { p1: { ideas: ["A time when"], starter: "I fixed it all. Done." } },
      rulesStarters({ picked: [], background: "", path: "" }),
    );
    expect(cleaned.p1.starter).toBe("I fixed it all. Done");
    expect(cleaned.p2.ideas.length).toBeGreaterThan(0);
  });
});
