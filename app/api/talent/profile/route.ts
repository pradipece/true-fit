import { requireAccess } from "@/lib/auth/server";
import { cleanDraft, MAX_DRAFT } from "@/lib/candidate-profile";
import { isSeedTalent } from "@/lib/auth/job-seekers";
import { db, dbConfigured } from "@/lib/db";

/**
 * The signed-in job seeker's own profile draft (table candidate_profiles):
 *
 *   GET → { draft, joined, updatedAt } | { draft: null }
 *   PUT { draft, joined? } → { updatedAt }
 *
 * The row is keyed by the session's candidate id, never by anything in the request, so a
 * job seeker can only read and write their own profile. Synthetic demo data only; a demo
 * reset (DELETE /api/demo-state) empties the table.
 */

const fail = (err: unknown) => {
  const error = err instanceof Error ? err.message : String(err);
  const hint = /does not exist/.test(error) ? "Profile table missing: run `yarn db:migrate`." : undefined;
  return Response.json({ error: hint ?? "Database error" }, { status: hint ? 503 : 502 });
};

export async function GET() {
  const guard = await requireAccess({ perm: "talent:profile" });
  if (guard.error) return guard.error;
  if (!dbConfigured()) return Response.json({ error: "No database is configured" }, { status: 503 });
  try {
    if (await isSeedTalent(guard.session.id)) return Response.json({ draft: null, readOnly: true });
    const { rows } = await db().query(
      `SELECT draft, joined, updated_at FROM candidate_profiles WHERE talent_id = $1`,
      [guard.session.id],
    );
    if (!rows[0]) return Response.json({ draft: null });
    return Response.json({
      draft: cleanDraft(rows[0].draft),
      joined: rows[0].joined,
      updatedAt: new Date(rows[0].updated_at).toISOString(),
    });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  const guard = await requireAccess({ perm: "talent:profile" });
  if (guard.error) return guard.error;
  if (!dbConfigured()) return Response.json({ error: "No database is configured" }, { status: 503 });
  const text = await request.text();
  if (text.length > MAX_DRAFT + 1000) return Response.json({ error: "Too large" }, { status: 413 });
  let body: { draft?: unknown; joined?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const draft = cleanDraft(body.draft);
  if (!draft) return Response.json({ error: "Invalid profile" }, { status: 400 });
  try {
    if (await isSeedTalent(guard.session.id))
      return Response.json({ error: "Demo candidates' profiles are view-only" }, { status: 403 });
    const { rows } = await db().query(
      `INSERT INTO candidate_profiles (talent_id, draft, joined, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (talent_id) DO UPDATE SET draft = EXCLUDED.draft,
         joined = candidate_profiles.joined OR EXCLUDED.joined, updated_at = now()
       RETURNING updated_at`,
      [guard.session.id, JSON.stringify(draft), body.joined === true],
    );
    return Response.json({ updatedAt: new Date(rows[0].updated_at).toISOString() });
  } catch (err) {
    return fail(err);
  }
}
