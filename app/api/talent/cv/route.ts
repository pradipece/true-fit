import { extractText, getDocumentProxy } from "unpdf";
import { aiEnabled, generateJson, logFallback } from "@/lib/ai";
import {
  cleanCvText,
  CV_SCHEMA,
  CV_SYSTEM_PROMPT,
  cvUserMessage,
  docxToText,
  looksLikeLinkedIn,
  rulesCvScan,
  sanitizeCvScan,
  stripContacts,
  type CvModelOutput,
  type CvScan,
} from "@/lib/cv-import";
import { getEsco } from "@/lib/seed-db";
import { requireAccess } from "@/lib/auth/server";

/**
 * CV import: a LinkedIn "Save to PDF" export or any ATS-style CV (text-based PDF, Word .docx,
 * .txt, or pasted text) → title, career summary, stated skills (with verbatim quotes) and languages.
 * The file is read in memory and never stored. Contact details are stripped before
 * Gemini sees the text; rules answer without a key or on any API error.
 */

const MAX_BYTES = 5_000_000;

async function readCv(request: Request): Promise<string | { error: string; status: number }> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return { error: "Choose a PDF, Word (.docx) or text file", status: 400 };
    if (file.size > MAX_BYTES) return { error: "That file is over 5 MB", status: 413 };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isDocx = /\.docx$/i.test(file.name) || file.type.includes("wordprocessingml");
    if (/\.(doc|rtf|odt|pages)$/i.test(file.name))
      return { error: "Save your CV as PDF or Word (.docx) and upload that.", status: 415 };
    if (isDocx) {
      try {
        return docxToText(bytes);
      } catch (error) {
        console.warn("[cv] DOCX text extraction failed", error);
        return { error: "Couldn't read that Word file. Try saving it as PDF.", status: 422 };
      }
    }
    if (!isPdf) {
      const text = new TextDecoder().decode(bytes);
      if (/[\u0000-\u0008]/.test(text.slice(0, 2000)))
        return { error: "Upload a PDF, a Word (.docx) file or plain text.", status: 415 };
      return text;
    }
    try {
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    } catch (error) {
      console.warn("[cv] PDF text extraction failed", error);
      return {
        error: "Couldn't read that PDF. Export it again from the original document, or paste the text.",
        status: 422,
      };
    }
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  return typeof body?.text === "string" ? body.text : "";
}

export async function POST(request: Request) {
  const guard = await requireAccess({ perm: "talent:profile" });
  if (guard.error) return guard.error;
  await getEsco(); // load the data from the database into the registries (lib/seed-db.ts)
  const raw = await readCv(request);
  if (typeof raw !== "string") return Response.json({ error: raw.error }, { status: raw.status });

  const cleaned = cleanCvText(raw);
  if (cleaned.length < 40)
    return Response.json(
      {
        error:
          "We couldn't find text in that file. Scanned images don't work: export your CV as PDF or Word from the original document, or paste the text.",
      },
      { status: 422 },
    );

  const linkedin = looksLikeLinkedIn(cleaned);
  const { text, removed: contacts } = stripContacts(cleaned);

  if (aiEnabled()) {
    try {
      const out = await generateJson<CvModelOutput>({
        system: CV_SYSTEM_PROMPT(),
        schema: CV_SCHEMA(),
        messages: [{ role: "user", content: cvUserMessage(text) }],
      });
      return Response.json({
        ...sanitizeCvScan(out, text, contacts),
        linkedin,
        source: "ai",
      } satisfies CvScan);
    } catch (error) {
      logFallback("cv", error);
    }
  } else logFallback("cv");

  return Response.json({ ...rulesCvScan(text, contacts), linkedin, source: "rules" } satisfies CvScan);
}
