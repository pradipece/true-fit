import { describe, expect, it } from "vitest";
import { SEED_TALENT } from "@/lib/data";
import { EMPTY_DRAFT } from "@/lib/intake";
import { cardFromToolArgs, liveSystemPrompt, liveToolResult } from "@/lib/intake-live";

const identifying = SEED_TALENT.flatMap((t) => [
  t.revealName,
  t.alias,
  t.headline,
  // City is left out: the prompt names the event city (Espoo) on purpose.
  t.contact?.fullName,
  t.contact?.email,
  t.contact?.phone,
]).filter((v): v is string => typeof v === "string" && v.length > 3);

describe("live voice intake", () => {
  it("keeps only cached skill ids from a tool call", () => {
    const card = cardFromToolArgs({
      title: "Data engineer",
      must: ["python", "made-up"],
      nice: ["python", "sql"],
    });
    expect(card.must).toEqual(["python"]);
    expect(card.nice).toEqual(["sql"]);
    expect(cardFromToolArgs("nonsense")).toEqual(EMPTY_DRAFT);
  });

  it("answers tool calls with aggregate counts only", () => {
    const res = liveToolResult({ ...EMPTY_DRAFT, title: "Dev", must: ["python", "sql"] }, SEED_TALENT);
    const text = JSON.stringify(res);
    for (const v of identifying) expect(text).not.toContain(v);
    for (const t of SEED_TALENT) expect(text).not.toContain(`"${t.id}"`);
    expect(res.card_pool.people).toBe(SEED_TALENT.length);
  });

  it("never puts anyone's details in the system prompt", () => {
    const prompt = liveSystemPrompt(EMPTY_DRAFT, SEED_TALENT);
    for (const v of identifying) expect(prompt).not.toContain(v);
  });
});
