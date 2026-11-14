import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import { SKILL_BY_ID } from "@/lib/esco";
import { explainMatch, type MatchNeed, type MatchTalent } from "@/lib/match";
import {
  finishRanking,
  MAX_RANKED,
  RANK_SYSTEM_PROMPT,
  rankInput,
  rankSchema,
  type RankResult,
} from "@/lib/match-rank";
import type { Evidence, SkillClaim } from "@/lib/types";

/**
 * "AI fit rate" for the candidates matched to one need. The browser sends the need's skills and
 * each candidate's id, skills and evidence, nothing else about the person. Scores are recomputed
 * here by the same rules; Gemini sees only that scoring output under labels C1…Cn and never the
 * ids. Rules fallback without a key or on any error.
 */

const skillIds = (xs: unknown) =>
  Array.isArray(xs)
    ? [...new Set(xs.filter((s): s is string => typeof s === "string" && !!SKILL_BY_ID[s]))]
    : [];

function parseTalent(t: unknown): MatchTalent | null {
  if (!t || typeof t !== "object") return null;
  const o = t as Record<string, unknown>;
  if (typeof o.id !== "string" || !Array.isArray(o.skills)) return null;
  const skills: SkillClaim[] = o.skills
    .filter(
      (s): s is SkillClaim =>
        !!s &&
        typeof s === "object" &&
        !!SKILL_BY_ID[s.id] &&
        (s.level === "evidenced" || s.level === "claimed"),
    )
    .map((s) => ({ id: s.id, level: s.level }));
  const evidence: Evidence[] = (Array.isArray(o.evidence) ? o.evidence : [])
    .filter((e): e is Evidence => !!e && typeof e.prompt === "string" && typeof e.excerpt === "string")
    .slice(0, 6)
    .map((e) => ({
      kind: e.kind,
      prompt: e.prompt.slice(0, 300),
      excerpt: e.excerpt.slice(0, 400),
      skills: skillIds(e.skills),
    }));
  return { id: o.id.slice(0, 40), skills, evidence };
}

export async function POST(request: Request) {
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
