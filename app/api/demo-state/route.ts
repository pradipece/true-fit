import { requireAccess } from "@/lib/auth/server";
import { authorizePatch } from "@/lib/auth/patch-rbac";
import { dbConfigured } from "@/lib/db";
import { cleanPatch } from "@/lib/demo-state";
import { clearState, isEmpty, readState, readVersion, writePatch } from "@/lib/demo-state-db";
import { getSeed } from "@/lib/seed-db";

/**
 * The demo's shared state in the database: every decision, request, Espoo interview,
 * company interview, offer, feedback, audit entry and created card. Uncached: it is live.
 *
 *   GET            → { version, empty, snapshot }   (?since=<version> → { version, unchanged: true })
 *   PATCH <Patch>  → { version }                    per-pair upserts, validated server-side
 *   DELETE         → { version }                    demo reset: empty the demo tables
 *
 * Behind the mock sign-in (lib/auth): reads need any role; each PATCH is checked field by
 * field against the database (lib/auth/patch-rbac.ts), so a company writes only its own
 * answers, a candidate only theirs, and only the organiser decides, logs and resets. The one
 * exception is an empty database, which any signed-in browser fills with the demo seed.
 */

const MAX_BODY = 1_000_000;

const fail = (err: unknown) => {
  const error = err instanceof Error ? err.message : String(err);
  const hint = /does not exist/.test(error) ? "Demo tables missing: run `yarn db:migrate`." : undefined;
  return Response.json({ error: hint ?? "Database error", detail: error }, { status: hint ? 503 : 502 });
};

export async function GET(request: Request) {
  const guard = await requireAccess();
  if (guard.error) return guard.error;
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
  const guard = await requireAccess();
  if (guard.error) return guard.error;
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
    if (!(await isEmpty())) {
      const [{ snapshot }, { needs }] = await Promise.all([readState(), getSeed()]);
      const denied = authorizePatch(patch, snapshot, guard.session, needs);
      if (denied) return Response.json({ error: denied }, { status: 403 });
    }
    return Response.json({ version: await writePatch(patch) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE() {
  const guard = await requireAccess({ perm: "organiser:reset" });
  if (guard.error) return guard.error;
  if (!dbConfigured()) return Response.json({ error: "No database is configured" }, { status: 503 });
  try {
    return Response.json({ version: await clearState() });
  } catch (err) {
    return fail(err);
  }
}
