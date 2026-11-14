import { ApiError, GoogleGenAI, ThinkingLevel, type Content } from "@google/genai";

/**
 * Server-only helper for structured Gemini calls. Import it from route handlers only:
 * it reads the API key from the environment.
 *
 * Every caller has a deterministic rules fallback, so the demo works without a key.
 * Set AI_MODE=rules to force the fallback even when a key is configured.
 */

export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

/** Each call gives up after this long; the rules answer instead. Chat turns must stay snappy. */
const TIMEOUT_MS = 15_000;
/** After an overload or timeout, skip Gemini for a while instead of making every turn wait. */
const COOLDOWN_MS = 60_000;
let coolingUntil = 0;

/** False with no key, with AI_MODE=rules, or while cooling down: callers use their fallback. */
export const aiEnabled = () => process.env.AI_MODE !== "rules" && !!apiKey() && Date.now() >= coolingUntil;

/** True when a key is configured. For routes with no fallback, which always try Gemini. */
export const aiConfigured = () => !!apiKey();

let client: GoogleGenAI | null = null;
const getClient = () =>
  (client ??= new GoogleGenAI({
    apiKey: apiKey(),
    httpOptions: { timeout: TIMEOUT_MS, retryOptions: { attempts: 1 } },
  }));

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
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
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
    if (apiKey() && process.env.AI_MODE !== "rules") return; // cooling down after an overload; already logged
    if (!warned.has("nokey")) console.warn("[ai] No GEMINI_API_KEY (or AI_MODE=rules); using offline rules.");
    warned.add("nokey");
    return;
  }
  const overloaded =
    (error instanceof ApiError && [429, 500, 503, 504].includes(error.status)) ||
    (error instanceof Error && /abort|timeout/i.test(`${error.name} ${error.message}`));
  if (overloaded) coolingUntil = Date.now() + COOLDOWN_MS;
  const pause = overloaded ? ` Pausing Gemini for ${COOLDOWN_MS / 1000}s.` : "";
  if (error instanceof ApiError) {
    console.warn(`[ai:${tag}] Gemini API error ${error.status}; using offline rules.${pause}`, error.message);
  } else if (overloaded) {
    console.warn(`[ai:${tag}] Gemini timed out after ${TIMEOUT_MS / 1000}s; using offline rules.${pause}`);
  } else {
    console.warn(`[ai:${tag}] Gemini call failed; using offline rules.`, error);
  }
}

/** Gemini accepts up to ~20 MB inline; a 60-second voice message is far below that. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

/**
 * Transcribe a short voice message with Gemini (audio sent inline, never stored).
 * Returns the spoken words only, in the language spoken. Throws on any failure.
 */
export async function transcribeAudio(audio: Uint8Array, mimeType: string): Promise<string> {
  const response = await getClient().models.generateContent({
    model: AI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: Buffer.from(audio).toString("base64") } },
          {
            text: "Transcribe this voice message word for word, in the language it is spoken in. It is a hiring manager describing who they want to recruit. Fix only obvious filler words (um, uh). If nothing intelligible is said, return an empty transcript.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        properties: { transcript: { type: "string" } },
        required: ["transcript"],
      },
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });
  const blocked = response.promptFeedback?.blockReason;
  if (blocked) throw new Error(`Prompt blocked: ${blocked}`);
  const text = response.text;
  if (!text) throw new Error("Empty response");
  const { transcript } = JSON.parse(text) as { transcript?: unknown };
  return typeof transcript === "string" ? transcript.trim().slice(0, 2000) : "";
}
