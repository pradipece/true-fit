import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import { explainMatch, type MatchNeed } from "@/lib/match";
import {
  finishRanking,
  MAX_RANKED,
  parseTalent,
  skillIds,
  RANK_SYSTEM_PROMPT,
  rankInput,
  rankSchema,
  type RankResult,
} from "@/lib/match-rank";
import { getEsco } from "@/lib/seed-db";
import { requireAccess } from "@/lib/auth/server";

/**
 * "AI fit rate" for the candidates matched to one need. The browser sends the need's skills and
 * each candidate's id, skills and evidence, nothing else about the person. Scores are recomputed
 * here by the same rules; Gemini sees only that scoring output under labels C1…Cn and never the
 * ids. Rules fallback without a key or on any error.
 */

export async function POST(request: Request) {
  const guard = await requireAccess({ perm: "ai:match" });
  if (guard.error) return guard.error;
  await getEsco(); // load the data from the database into the registries (lib/seed-db.ts)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const n = body?.need as Record<string, unknown> | undefined;
  const must = skillIds(n?.must);
  const talent = (Array.isArray(body?.talent) ? body.talent : []).map(parseTalent).filter((t) => !!t);
  if (!n || !must.length || !talent.length)
    return Response.json({ error: "Invalid ranking request" }, { status: 400 });

  const need: MatchNeed = { id: "need", must, nice: skillIds(n.nice).filter((s) => !must.includes(s)) };
  const role = typeof n.title === "string" ? n.title.slice(0, 80) : "this";
  const matches = talent
    .map((t) => explainMatch(need, t))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RANKED);
  const input = rankInput(role, matches);
  const ids = matches.map((m) => m.talentId);

  if (aiEnabled()) {
    try {
      const out = await generateJson<{ ranking: { label: string; fit: number; reason: string }[] }>({
        system: RANK_SYSTEM_PROMPT,
        schema: rankSchema(input.candidates.map((c) => c.label)),
        messages: [
          { role: "user", content: `<scoring_output>\n${JSON.stringify(input, null, 2)}\n</scoring_output>` },
        ],
      });
      if (Array.isArray(out.ranking) && out.ranking.length)
        return Response.json({
          ranking: finishRanking(input, ids, out.ranking),
          source: "ai",
        } satisfies RankResult);
    } catch (error) {
      logFallback("rank", error);
    }
  } else logFallback("rank");

  return Response.json({ ranking: finishRanking(input, ids, null), source: "rules" } satisfies RankResult);
}
