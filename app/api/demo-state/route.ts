import { dbConfigured } from "@/lib/db";
import { cleanPatch } from "@/lib/demo-state";
import { clearState, isEmpty, readState, readVersion, writePatch } from "@/lib/demo-state-db";

/**
 * The demo's shared state in the database: every decision, request, Espoo interview,
 * company interview, offer, feedback, audit entry and created card. Uncached: it is live.
 *
 *   GET            → { version, empty, snapshot }   (?since=<version> → { version, unchanged: true })
 *   PATCH <Patch>  → { version }                    per-pair upserts, validated server-side
 *   DELETE         → { version }                    demo reset: empty the demo tables
 *
 * Synthetic demo data only. A real deployment would put this behind sign-in, with each
 * participant allowed to write only their own answers.
 */

const MAX_BODY = 1_000_000;

const fail = (err: unknown) => {
  const error = err instanceof Error ? err.message : String(err);
  const hint = /does not exist/.test(error) ? "Demo tables missing: run `yarn db:migrate`." : undefined;
  return Response.json({ error: hint ?? "Database error", detail: error }, { status: hint ? 503 : 502 });
};

export async function GET(request: Request) {
  if (!dbConfigured()) return Response.json({ error: "No database is configured" }, { status: 503 });
  try {
    const since = Number(new URL(request.url).searchParams.get("since"));
    if (Number.isFinite(since) && since > 0 && since === (await readVersion()))
      return Response.json({ version: since, unchanged: true });
    const { version, snapshot } = await readState();
    return Response.json({ version, empty: await isEmpty(), snapshot });
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(request: Request) {
  if (!dbConfigured()) return Response.json({ error: "No database is configured" }, { status: 503 });
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "Too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const patch = cleanPatch(body);
  if (!patch) return Response.json({ error: "Invalid patch" }, { status: 400 });
  try {
    return Response.json({ version: await writePatch(patch) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE() {
  if (!dbConfigured()) return Response.json({ error: "No database is configured" }, { status: 503 });
  try {
    return Response.json({ version: await clearState() });
  } catch (err) {
    return fail(err);
  }
}
