import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import { parseTalent, rankSchema, skillIds } from "@/lib/match-rank";
import {
  finishRoleRanking,
  MAX_ROLES,
  ROLE_RANK_SYSTEM_PROMPT,
  roleRankInput,
  rulesRoleRanking,
  type RoleIn,
  type RoleRankResult,
} from "@/lib/role-rank";
import { getEsco } from "@/lib/seed-db";

/**
 * "Companies that suit you best" for a job seeker. The browser sends the person's own skills
 * and evidence and the public role cards at the event; scores are recomputed here by the same
 * skills-only rules, and Gemini sees only that scoring output under labels R1…Rn.
 * Rules fallback without a key or on any error.
 */

const str = (v: unknown, max = 80) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

function parseRole(r: unknown, i: number): RoleIn | null {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  const must = skillIds(o.must);
  if (!must.length) return null;
  return {
    id: str(o.id, 40) || `role-${i}`,
    title: str(o.title) || "Untitled role",
    company: str(o.company) || "A company",
    companyId: str(o.companyId, 40) || str(o.company) || `company-${i}`,
    must,
    nice: skillIds(o.nice).filter((s) => !must.includes(s)),
  };
}

export async function POST(request: Request) {
  await getEsco(); // load the data from the database into the registries (lib/seed-db.ts)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const talent = parseTalent({ ...(body?.talent as object), id: "me" });
  const roles = (Array.isArray(body?.roles) ? body.roles : [])
    .slice(0, MAX_ROLES)
    .map(parseRole)
    .filter((r) => !!r);
  if (!talent || !talent.skills.length || !roles.length)
    return Response.json({ error: "Invalid request" }, { status: 400 });

  const { input, needIds } = roleRankInput(roles, talent);

  if (aiEnabled()) {
    try {
      const out = await generateJson<{ ranking: { label: string; fit: number; reason: string }[] }>({
        system: ROLE_RANK_SYSTEM_PROMPT,
        schema: rankSchema(input.candidates.map((c) => c.label)),
        messages: [
          { role: "user", content: `<scoring_output>\n${JSON.stringify(input, null, 2)}\n</scoring_output>` },
        ],
      });
      if (Array.isArray(out.ranking) && out.ranking.length)
        return Response.json({
          ranking: finishRoleRanking(input, needIds, out.ranking),
          source: "ai",
        } satisfies RoleRankResult);
    } catch (error) {
      logFallback("talent-companies", error);
    }
  } else {
    logFallback("talent-companies");
  }
  return Response.json({
    ranking: rulesRoleRanking(input, needIds),
    source: "rules",
  } satisfies RoleRankResult);
}
