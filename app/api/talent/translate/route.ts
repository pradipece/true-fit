import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import { getOccupation, searchEsco } from "@/lib/esco-api";
import {
  rulesTranslate,
  sanitizeTranslation,
  TRANSLATE_SCHEMA,
  TRANSLATE_SYSTEM_PROMPT,
  type EscoLookup,
  type TranslateModelOutput,
  type Translation,
} from "@/lib/talent-ai";
import { getEsco } from "@/lib/seed-db";
import { requireAccess } from "@/lib/auth/server";

/**
 * Skills translator: past job title and/or career path → ESCO occupation, skills and
 * Finnish job-ad vocabulary. Gemini when configured, rules otherwise.
 */
export async function POST(request: Request) {
  const guard = await requireAccess({ perm: "talent:profile" });
  if (guard.error) return guard.error;
  await getEsco(); // load the data from the database into the registries (lib/seed-db.ts)
  const body = (await request.json().catch(() => null)) as { title?: unknown; path?: unknown } | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const path = typeof body?.path === "string" ? body.path.trim().slice(0, 1500) : "";
  if (!title && !path) return Response.json({ error: "Give a job title or career path" }, { status: 400 });

  // Official ESCO lookup runs alongside the translation; only the typed title is sent.
  const esco = escoLookup(title);

  if (aiEnabled()) {
    try {
      const out = await generateJson<TranslateModelOutput>({
        system: TRANSLATE_SYSTEM_PROMPT(),
        schema: TRANSLATE_SCHEMA(),
        messages: [
          {
            role: "user",
            content: `<job_title>${title || "not given"}</job_title>\n<career_path>${path || "not given"}</career_path>`,
          },
        ],
      });
      return Response.json({
        ...sanitizeTranslation(out),
        esco: await esco,
        source: "ai",
      } satisfies Translation);
    } catch (error) {
      logFallback("translate", error);
    }
  } else logFallback("translate");

  return Response.json({
    ...rulesTranslate({ title, path }),
    esco: await esco,
    source: "rules",
  } satisfies Translation);
}

async function escoLookup(title: string): Promise<EscoLookup> {
  if (title.length < 3) return { status: "skipped" };
  try {
    const hits = await searchEsco(title, "occupation", { limit: 3 });
    if (!hits.length) return { status: "none" };
    return {
      status: "found",
      occupation: await getOccupation(hits[0].uri),
      others: hits.slice(1).map((h) => ({ uri: h.uri, title: h.title })),
    };
  } catch (error) {
    console.warn("[esco] translator lookup failed", error);
    return { status: "unavailable" };
  }
}
