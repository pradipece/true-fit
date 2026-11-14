import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import { SKILL_BY_ID } from "@/lib/esco";
import {
  EVIDENCE_SYSTEM_PROMPT,
  evidenceSchema,
  evidenceUserMessage,
  rulesEvidence,
  sanitizeEvidence,
  type EvidenceAnswer,
  type EvidenceModelOutput,
  type EvidenceRequest,
  type EvidenceResult,
} from "@/lib/talent-ai";

/**
 * Evidence mapping: written answers → ESCO skills, each backed by a verbatim quote,
 * plus a privacy check. Gemini when configured, rules otherwise. The person reviews
 * every mapping before it reaches their card.
 */

const KINDS: EvidenceAnswer["kind"][] = ["scenario", "voice", "sample"];

function parseBody(body: unknown): EvidenceRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.answers)) return null;
  const answers = b.answers
    .filter(
      (a): a is EvidenceAnswer =>
        !!a &&
        typeof a === "object" &&
        typeof a.id === "string" &&
        /^[\w-]{1,20}$/.test(a.id) &&
        KINDS.includes(a.kind) &&
        typeof a.prompt === "string" &&
        typeof a.text === "string" &&
        a.text.trim().length > 0,
    )
    .slice(0, 8)
    .map((a) => ({
      id: a.id,
      kind: a.kind,
      label: String(a.label ?? a.id).slice(0, 40),
      prompt: a.prompt.slice(0, 300),
      text: a.text.slice(0, a.kind === "sample" ? 4000 : 2500),
    }));
  if (!answers.length) return null;
  const picked = Array.isArray(b.picked)
    ? b.picked.filter((s): s is string => typeof s === "string" && !!SKILL_BY_ID[s])
    : [];
  const background = typeof b.background === "string" ? b.background.slice(0, 200) : "";
  return { answers, picked, background };
}

export async function POST(request: Request) {
  const req = parseBody(await request.json().catch(() => null));
  if (!req) return Response.json({ error: "Write at least one answer first" }, { status: 400 });

  if (aiEnabled()) {
    try {
      const out = await generateJson<EvidenceModelOutput>({
        system: EVIDENCE_SYSTEM_PROMPT,
        schema: evidenceSchema(req.answers.map((a) => a.id)),
        messages: [{ role: "user", content: evidenceUserMessage(req) }],
      });
      return Response.json({ ...sanitizeEvidence(out, req), source: "ai" } satisfies EvidenceResult);
    } catch (error) {
      logFallback("evidence", error);
    }
  } else logFallback("evidence");

  return Response.json({ ...rulesEvidence(req), source: "rules" } satisfies EvidenceResult);
}
