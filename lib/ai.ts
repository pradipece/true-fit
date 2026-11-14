import { ApiError, GoogleGenAI, ThinkingLevel, type Content } from "@google/genai";

/**
 * Server-only helper for structured Gemini calls. Import it from route handlers only:
 * it reads the API key from the environment.
 *
 * Every caller has a deterministic rules fallback, so the demo works without a key.
 * Set AI_MODE=rules to force the fallback even when a key is configured.
 */

export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

/** False when there is no key or AI_MODE=rules: callers go straight to their fallback. */
export const aiEnabled = () => process.env.AI_MODE !== "rules" && !!apiKey();

let client: GoogleGenAI | null = null;
const getClient = () => (client ??= new GoogleGenAI({ apiKey: apiKey(), httpOptions: { timeout: 45_000 } }));

export type AiMessage = { role: "user" | "assistant"; content: string };

/**
 * One Gemini call returning JSON that matches `schema` (JSON Schema subset).
 * Throws on any failure; callers catch and fall back to rules.
 */
export async function generateJson<T>({
  system,
  messages,
  schema,
}: {
  system: string;
  messages: AiMessage[];
  schema: object;
}): Promise<T> {
  const contents: Content[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await getClient().models.generateContent({
    model: AI_MODEL,
    contents,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      // Short structuring tasks: low thinking keeps the chat snappy.
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const blocked = response.promptFeedback?.blockReason;
  if (blocked) throw new Error(`Prompt blocked: ${blocked}`);
  const finish = response.candidates?.[0]?.finishReason;
  if (finish && finish !== "STOP") throw new Error(`Generation stopped: ${finish}`);
  const text = response.text;
  if (!text) throw new Error("Empty response");
  return JSON.parse(text) as T;
}

const warned = new Set<string>();

/** Log why a route fell back to rules, without flooding the console. */
export function logFallback(tag: string, error?: unknown) {
  if (!error) {
    if (!warned.has("nokey")) console.warn("[ai] No GEMINI_API_KEY (or AI_MODE=rules); using offline rules.");
    warned.add("nokey");
    return;
  }
  if (error instanceof ApiError) {
    console.warn(`[ai:${tag}] Gemini API error ${error.status}; using offline rules.`, error.message);
  } else {
    console.warn(`[ai:${tag}] Gemini call failed; using offline rules.`, error);
  }
}
