import { db, dbConfigured } from "@/lib/db";

/**
 * Live Supabase check: can the server connect (with a verified TLS certificate), and
 * how many seed rows are there? Counts only, no rows. Uncached so it reflects now.
 */
export async function GET() {
  if (!dbConfigured())
    return Response.json({ ok: false, error: "Supabase database is not configured" }, { status: 503 });
  try {
    const { rows } = await db().query(
      `SELECT (SELECT count(*) FROM companies)::int AS companies,
              (SELECT count(*) FROM needs)::int AS needs,
              (SELECT count(*) FROM talent)::int AS talent,
              (SELECT count(*) FROM esco_skills)::int AS esco_skills`,
    );
    return Response.json({ ok: true, counts: rows[0] });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const hint = /does not exist/.test(error) ? "Tables missing: run `yarn db:migrate`." : undefined;
    return Response.json({ ok: false, error, hint }, { status: 502 });
  }
}
