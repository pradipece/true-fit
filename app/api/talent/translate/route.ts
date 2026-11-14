import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import {
  rulesTranslate,
  sanitizeTranslation,
  TRANSLATE_SCHEMA,
  TRANSLATE_SYSTEM_PROMPT,
  type TranslateModelOutput,
  type Translation,
} from "@/lib/talent-ai";

/**
 * Skills translator: past job title and/or career path → ESCO occupation, skills and
 * Finnish job-ad vocabulary. Gemini when configured, rules otherwise.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { title?: unknown; path?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const path = typeof body?.path === "string" ? body.path.trim().slice(0, 1500) : "";
  if (!title && !path) return Response.json({ error: "Give a job title or career path" }, { status: 400 });

  if (aiEnabled()) {
    try {
      const out = await generateJson<TranslateModelOutput>({
        system: TRANSLATE_SYSTEM_PROMPT,
        schema: TRANSLATE_SCHEMA,
        messages: [
          {
            role: "user",
            content: `<job_title>${title || "not given"}</job_title>\n<career_path>${path || "not given"}</career_path>`,
          },
        ],
      });
      return Response.json({ ...sanitizeTranslation(out), source: "ai" } satisfies Translation);
    } catch (error) {
      logFallback("translate", error);
    }
  } else logFallback("translate");

  return Response.json({ ...rulesTranslate({ title, path }), source: "rules" } satisfies Translation);
}
