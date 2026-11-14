import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import { SKILL_BY_ID } from "@/lib/esco";
import {
  rulesStarters,
  sanitizeStarters,
  STARTERS_SCHEMA,
  STARTERS_SYSTEM_PROMPT,
  startersUserMessage,
  type PromptIdeas,
  type Starters,
  type StarterPromptId,
  type StartersRequest,
} from "@/lib/talent-ai";

/**
 * Writing ideas for the evidence answers, tailored to the person's picked skills and
 * background. Ideas and half-sentence starters only, never full answers.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const req: StartersRequest = {
    picked: Array.isArray(body?.picked)
      ? body.picked.filter((s): s is string => typeof s === "string" && !!SKILL_BY_ID[s]).slice(0, 10)
      : [],
    background: typeof body?.background === "string" ? body.background.slice(0, 160) : "",
    path: typeof body?.path === "string" ? body.path.slice(0, 800) : "",
  };
  const fallback = rulesStarters(req);

  if (aiEnabled()) {
    try {
      const out = await generateJson<Partial<Record<StarterPromptId, Partial<PromptIdeas>>>>({
        system: STARTERS_SYSTEM_PROMPT,
        schema: STARTERS_SCHEMA,
        messages: [{ role: "user", content: startersUserMessage(req) }],
      });
      return Response.json({ prompts: sanitizeStarters(out, fallback), source: "ai" } satisfies Starters);
    } catch (error) {
      logFallback("starters", error);
    }
  } else logFallback("starters");

  return Response.json({ prompts: fallback, source: "rules" } satisfies Starters);
}
