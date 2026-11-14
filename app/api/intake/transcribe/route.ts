import { aiConfigured, logFallback, MAX_AUDIO_BYTES, transcribeAudio } from "@/lib/ai";

/**
 * Speech input for the company intake chat: a short recording in, Gemini's transcript out.
 *
 * The audio is passed straight to Gemini and never stored. The transcript goes back to the
 * chat input, where the user reads and edits it before sending; nothing is sent on their behalf.
 * Like the chat itself, this needs Gemini: errors come back as { error } with a 5xx/4xx status.
 */

const AUDIO_TYPE = /^audio\/(webm|ogg|mp4|mpeg|wav|x-wav|aac|flac|x-m4a)\b/;

export async function POST(request: Request) {
  if (!aiConfigured())
    return Response.json({ error: "Voice input needs the AI, which isn't configured." }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof Blob) || !file.size)
    return Response.json({ error: "No recording received." }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES)
    return Response.json({ error: "That recording is too long. Keep it under a minute." }, { status: 413 });
  // Browsers add codec parameters (audio/webm;codecs=opus); Gemini wants the bare type.
  const mimeType = file.type.split(";")[0].trim().toLowerCase();
  if (!AUDIO_TYPE.test(mimeType))
    return Response.json({ error: "Unsupported audio format." }, { status: 415 });

  try {
    const transcript = await transcribeAudio(new Uint8Array(await file.arrayBuffer()), mimeType);
    return Response.json({ transcript });
  } catch (error) {
    logFallback("transcribe", error);
    return Response.json(
      { error: "Couldn't turn the recording into text. Try again or type your answer." },
      { status: 502 },
    );
  }
}
