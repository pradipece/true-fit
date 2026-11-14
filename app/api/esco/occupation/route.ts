import type { NextRequest } from "next/server";
import { getOccupation } from "@/lib/esco-api";

/** One ESCO occupation with its essential and optional skills: /api/esco/occupation?uri=… */
export async function GET(request: NextRequest) {
  const uri = request.nextUrl.searchParams.get("uri") ?? "";
  if (!/^http:\/\/data\.europa\.eu\/esco\/occupation\/[\w-]+$/.test(uri))
    return Response.json({ error: "Not an ESCO occupation URI" }, { status: 400 });
  try {
    return Response.json(await getOccupation(uri));
  } catch (error) {
    console.warn("[esco] occupation failed", error);
    return Response.json({ error: "The ESCO service isn't reachable right now." }, { status: 502 });
  }
}
