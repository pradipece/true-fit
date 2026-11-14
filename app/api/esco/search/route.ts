import type { NextRequest } from "next/server";
import { searchEsco, toSubset } from "@/lib/esco-api";

/**
 * Live ESCO search, e.g. /api/esco/search?q=lagerchef&type=occupation.
 * Searches several languages at once; skill hits are linked to the event's skill set.
 * Only the typed text goes to ESCO. Responses are cached per query for a day.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type") === "occupation" ? "occupation" : "skill";
  if (q.length < 2) return Response.json({ error: "Type at least 2 characters" }, { status: 400 });
  try {
    const hits = await searchEsco(q, type, { limit: type === "skill" ? 6 : 4 });
    return Response.json({
      hits: hits.map((h) => ({ ...h, subset: type === "skill" ? toSubset(h.uri, h.title) : undefined })),
      source: "esco",
    });
  } catch (error) {
    console.warn("[esco] search failed", error);
    return Response.json({ error: "The ESCO service isn't reachable right now." }, { status: 502 });
  }
}
