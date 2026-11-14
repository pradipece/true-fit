import { versionInfo } from "@/lib/version";

// Prerendered per build: each deployment serves its own build id, which open tabs
// compare against the one they loaded. no-store keeps CDNs and browsers from
// returning an old deployment's answer.
export function GET() {
  return Response.json(versionInfo, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
