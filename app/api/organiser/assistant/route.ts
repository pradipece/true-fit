import { aiEnabled, generateJson, logFallback, type AiMessage } from "@/lib/ai";
import {
  ASSISTANT_SCHEMA,
  ASSISTANT_SYSTEM_PROMPT,
  rulesReply,
  sanitizeReply,
  sanitizeSnapshot,
  type AssistantReply,
} from "@/lib/organiser-assistant";
import { getSeed } from "@/lib/seed-db";

/**
 * Espoo Esbo assistant: answers the organiser's questions about the event. The browser
 * sends the chat and an aggregate snapshot (counts per company need, totals, fairness
 * ratios); the snapshot is re-validated here and nothing about any individual is accepted
 * or sent on. Gemini when configured, rule-based answers otherwise.
 */

const MAX_TURNS = 20;

function parseMessages(raw: unknown): AiMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is AiMessage =>
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        !!m.content.trim(),
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
}

export async function POST(request: Request) {
  await getSeed(); // load the data from the database into the registries (lib/seed-db.ts)
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const snapshot = sanitizeSnapshot(body?.snapshot);
  const messages = parseMessages(body?.messages);
  const last = messages.at(-1);
  if (!snapshot || last?.role !== "user") return Response.json({ error: "Invalid request" }, { status: 400 });

  if (aiEnabled()) {
    try {
      // The snapshot rides on the latest question, so answers reflect the event right now.
      const out = await generateJson<Partial<AssistantReply>>({
        system: ASSISTANT_SYSTEM_PROMPT,
        schema: ASSISTANT_SCHEMA,
        messages: [
          ...messages.slice(0, -1),
          {
            role: "user",
            content: `<event_snapshot>\n${JSON.stringify(snapshot)}\n</event_snapshot>\n\n${last.content}`,
          },
        ],
      });
      const reply = sanitizeReply(out);
      if (reply) return Response.json({ ...reply, source: "ai" });
    } catch (error) {
      logFallback("organiser-assistant", error);
    }
  } else {
    logFallback("organiser-assistant");
  }
  return Response.json({ ...rulesReply(last.content, snapshot), source: "rules" });
}
