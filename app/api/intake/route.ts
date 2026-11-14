import { aiConfigured, generateJson, logFallback } from "@/lib/ai";
import { SEED_TALENT } from "@/lib/data";
import {
  INTAKE_OUTPUT_SCHEMA,
  INTAKE_SYSTEM_PROMPT,
  missingFields,
  sanitizeDraft,
  poolSummary,
  withCurrentCard,
  type IntakeRequest,
  type IntakeTurn,
  type Topic,
} from "@/lib/intake";

/**
 * Intake assistant: one Gemini call per chat turn, returning a structured need-card draft.
 *
 * Only the company's own words, the draft card and aggregate pool counts are sent,
 * never data about any individual.
 * The chat requires Gemini and an internet connection: there is no offline fallback.
 * Errors come back as { error } with a 5xx status so the chat can offer a retry.
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
      content:
        i === history.length - 1
          ? withCurrentCard(m.content, req.draft, poolSummary(SEED_TALENT))
          : m.content,
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

  // The chat has no offline fallback: it needs Gemini, so it always tries (no cooldown skip).
  if (!aiConfigured())
    return Response.json(
      { error: "The intake assistant isn't set up yet (no GEMINI_API_KEY on the server)." },
      { status: 503 },
    );
  try {
    return Response.json(await aiTurn(req));
  } catch (error) {
    logFallback("intake", error);
    return Response.json(
      { error: "The assistant couldn't answer just now. Check your connection and try again." },
      { status: 502 },
    );
  }
}
