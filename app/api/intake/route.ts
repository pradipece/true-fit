import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import {
  INTAKE_OUTPUT_SCHEMA,
  INTAKE_SYSTEM_PROMPT,
  missingFields,
  rulesTurn,
  sanitizeDraft,
  withCurrentCard,
  type IntakeRequest,
  type IntakeTurn,
  type Topic,
} from "@/lib/intake";

/**
 * Intake assistant: one Gemini call per chat turn, returning a structured need-card draft.
 *
 * Only the company's own words and the draft card are sent, never talent data.
 * Without GEMINI_API_KEY (or with AI_MODE=rules), or if the call fails, the
 * deterministic rules engine answers instead so the demo always works offline.
 */

const MAX_TURNS = 30;
const TOPICS: Topic[] = ["area", "tasks", "must", "language", "timing", "mode"];

function parseBody(body: unknown): IntakeRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages)) return null;
  const messages = b.messages
    .filter(
      (m): m is IntakeRequest["messages"][number] =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (messages[messages.length - 1]?.role !== "user") return null;
  const asked = Array.isArray(b.asked) ? b.asked.filter((t): t is Topic => TOPICS.includes(t)) : [];
  return { messages, draft: sanitizeDraft((b.draft ?? {}) as IntakeRequest["draft"]), asked };
}

async function aiTurn(req: IntakeRequest): Promise<IntakeTurn> {
  // Start the model's history at the first user turn; the greeting is scripted.
  const history = req.messages.slice(req.messages.findIndex((m) => m.role === "user"));
  const out = await generateJson<{
    reply: string;
    quick_replies: string[];
    draft: IntakeRequest["draft"];
    ready: boolean;
  }>({
    system: INTAKE_SYSTEM_PROMPT,
    schema: INTAKE_OUTPUT_SCHEMA,
    messages: history.map((m, i) => ({
      role: m.role,
      content: i === history.length - 1 ? withCurrentCard(m.content, req.draft) : m.content,
    })),
  });
  const draft = sanitizeDraft(out.draft);
  return {
    reply: out.reply,
    quickReplies: (out.quick_replies ?? []).filter((q) => typeof q === "string").slice(0, 4),
    draft,
    asked: req.asked,
    // Trust the card, not the flag: ready means every required field is filled.
    ready: !!out.ready && missingFields(draft).length === 0,
    source: "ai",
  };
}

export async function POST(request: Request) {
  const req = parseBody(await request.json().catch(() => null));
  if (!req) return Response.json({ error: "Invalid intake request" }, { status: 400 });

  if (aiEnabled()) {
    try {
      return Response.json(await aiTurn(req));
    } catch (error) {
      logFallback("intake", error);
    }
  } else logFallback("intake");

  return Response.json({ ...rulesTurn(req), source: "rules" } satisfies IntakeTurn);
}
