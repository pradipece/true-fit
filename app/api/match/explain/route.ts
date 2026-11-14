import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import { SKILL_BY_ID } from "@/lib/esco";
import { explainMatch, type MatchNeed, type MatchTalent } from "@/lib/match";
import {
  EXPLAIN_SCHEMA,
  EXPLAIN_SYSTEM_PROMPT,
  explainInput,
  rulesWhy,
  type WhyText,
} from "@/lib/match-explain";
import type { Evidence, SkillClaim } from "@/lib/types";
import { getEsco } from "@/lib/seed-db";
import { requireAccess } from "@/lib/auth/server";

/**
 * "Why this match" text. The browser sends only the need's skills and the talent's skills
 * and evidence, nothing else about the person. The score is recomputed here by the same
 * rules, so the text always describes the real scoring output. Gemini when configured,
 * template otherwise.
 */

const skillIds = (xs: unknown) =>
  Array.isArray(xs)
    ? [...new Set(xs.filter((s): s is string => typeof s === "string" && !!SKILL_BY_ID[s]))]
    : [];

function parseBody(body: unknown): { role: string; need: MatchNeed; talent: MatchTalent } | null {
  if (!body || typeof body !== "object") return null;
  const { need: n, talent: t } = body as { need?: Record<string, unknown>; talent?: Record<string, unknown> };
  if (!n || !t || !Array.isArray(t.skills)) return null;

  const skills: SkillClaim[] = t.skills
    .filter(
      (s): s is SkillClaim =>
        !!s &&
        typeof s === "object" &&
        !!SKILL_BY_ID[s.id] &&
        (s.level === "evidenced" || s.level === "claimed"),
    )
    .map((s) => ({ id: s.id, level: s.level }));
  const evidence: Evidence[] = (Array.isArray(t.evidence) ? t.evidence : [])
    .filter((e): e is Evidence => !!e && typeof e.prompt === "string" && typeof e.excerpt === "string")
    .slice(0, 6)
    .map((e) => ({
      kind: e.kind,
      prompt: e.prompt.slice(0, 300),
      excerpt: e.excerpt.slice(0, 400),
      skills: skillIds(e.skills),
    }));
  const must = skillIds(n.must);
  if (!must.length) return null;

  return {
    role: typeof n.title === "string" ? n.title.slice(0, 80) : "this",
    need: {
      id: String(n.id ?? "need").slice(0, 20),
      must,
      nice: skillIds(n.nice).filter((s) => !must.includes(s)),
    },
    talent: { id: String(t.id ?? "talent").slice(0, 20), skills, evidence },
  };
}

export async function POST(request: Request) {
  const guard = await requireAccess({ perm: "ai:match" });
  if (guard.error) return guard.error;
  await getEsco(); // load the data from the database into the registries (lib/seed-db.ts)
  const req = parseBody(await request.json().catch(() => null));
  if (!req) return Response.json({ error: "Invalid match" }, { status: 400 });

  const input = explainInput(req.role, explainMatch(req.need, req.talent));

  if (aiEnabled()) {
    try {
      const out = await generateJson<{ why: string; ask: string }>({
        system: EXPLAIN_SYSTEM_PROMPT,
        schema: EXPLAIN_SCHEMA,
        messages: [
          { role: "user", content: `<scoring_output>\n${JSON.stringify(input, null, 2)}\n</scoring_output>` },
        ],
      });
      if (out.why?.trim())
        return Response.json({
          why: out.why.trim().slice(0, 600),
          ask: (out.ask ?? "").trim().slice(0, 240),
          source: "ai",
        } satisfies WhyText);
    } catch (error) {
      logFallback("explain", error);
    }
  } else logFallback("explain");

  return Response.json({ ...rulesWhy(input), source: "rules" } satisfies WhyText);
}
