import { GoogleGenAI, Modality } from "@google/genai";
import { sanitizeDraft, type NeedDraft } from "@/lib/intake";
import { LIVE_MODEL, LIVE_SESSION_MINUTES, LIVE_TOOLS, liveSystemPrompt } from "@/lib/intake-live";
import { getSeed } from "@/lib/seed-db";

/**
 * Starts a live voice session with Gemini: returns a single-use ephemeral token, never the API key.
 *
 * The model, system prompt (with the current card and aggregate pool counts) and the one tool
 * are locked into the token, so the browser can't change what Gemini is told or allowed to do.
 * The token must be used within a minute and the session ends after LIVE_SESSION_MINUTES.
 * Like the text chat, live voice needs Gemini: errors come back as { error } with a 5xx status.
 */

const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

export async function POST(request: Request) {
  await getSeed(); // load the data from the database into the registries (lib/seed-db.ts)
  const key = apiKey();
  if (!key)
    return Response.json({ error: "Live voice needs the AI, which isn't configured." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { draft?: Partial<NeedDraft> };
  const draft = sanitizeDraft(body.draft ?? {});
  const pool = (await getSeed()).talent;
  const now = Date.now();

  try {
    const client = new GoogleGenAI({ apiKey: key, httpOptions: { apiVersion: "v1alpha" } });
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + LIVE_SESSION_MINUTES * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: liveSystemPrompt(draft, pool),
            tools: LIVE_TOOLS,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });
    if (!token.name) throw new Error("No token returned");
    return Response.json({ token: token.name, model: LIVE_MODEL });
  } catch (error) {
    console.warn("[ai:live] Couldn't start a live session.", error);
    return Response.json(
      { error: "Couldn't start a live conversation. Try again or type instead." },
      { status: 502 },
    );
  }
}
