import { cacheLife } from "next/cache";
import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import {
  cleanQuickReplies,
  DEFAULT_STARTERS,
  poolSummary,
  STARTERS_OUTPUT_SCHEMA,
  STARTERS_SYSTEM_PROMPT,
} from "@/lib/intake";
import { getSeed } from "@/lib/seed-db";

/**
 * Opening suggestions for the intake chat, written by Gemini from aggregate pool counts
 * (never individuals) so the first tap points at areas the pool can fill. Cached for an
 * hour; falls back to fixed starters without a key, on an error or with AI_MODE=rules.
 */

async function tailoredStarters() {
  "use cache";
  cacheLife("hours");
  const pool = (await getSeed()).talent;
  const out = await generateJson<{ starters: string[] }>({
    system: STARTERS_SYSTEM_PROMPT,
    schema: STARTERS_OUTPUT_SCHEMA,
    messages: [
      { role: "user", content: `<pool_summary>\n${JSON.stringify(poolSummary(pool))}\n</pool_summary>` },
    ],
  });
  const starters = cleanQuickReplies(out.starters).slice(0, 3);
  // Throwing keeps a bad answer out of the cache.
  if (starters.length < 2) throw new Error("Too few usable starters");
  return starters;
}

export async function GET() {
  if (!aiEnabled()) return Response.json({ starters: DEFAULT_STARTERS, source: "rules" });
  try {
    return Response.json({ starters: await tailoredStarters(), source: "ai" });
  } catch (error) {
    logFallback("intake-starters", error);
    return Response.json({ starters: DEFAULT_STARTERS, source: "rules" });
  }
}
