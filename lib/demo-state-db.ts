import { db } from "./db";
import type { Patch, PairRow, Snapshot } from "./demo-state";
import type { AuditEntry, Need, Talent } from "./types";

/**
 * Server-only reads and writes of the demo state (tables in db/schema.sql). Writes are
 * per pair (upsert / delete), the audit log is insert-only, and every write bumps one
 * version counter so other browsers know to reload.
 */

export async function readState(): Promise<{ version: number; snapshot: Snapshot }> {
  const pool = db();
  const [pairs, audit, cards, meta] = await Promise.all([
    pool.query(
      `SELECT pair_key, decision, opt_in, screening, interview_slot, offer, feedback FROM pipeline_pairs`,
    ),
    pool.query(
      `SELECT id, at, actor, action, need_id, talent_id, from_status, to_status, reason, note
         FROM pipeline_audit ORDER BY at, id`,
    ),
    pool.query(`SELECT kind, data FROM demo_cards ORDER BY updated_at DESC`),
    pool.query(`SELECT version FROM demo_state_meta WHERE id = 1`),
  ]);
  const snapshot: Snapshot = { pairs: {}, audit: [], needs: [], talent: [] };
  for (const r of pairs.rows) {
    const row: PairRow = {};
    if (r.decision) row.decision = r.decision;
    if (r.opt_in) row.optIn = r.opt_in;
    if (r.screening) row.screening = r.screening;
    if (r.interview_slot) row.slot = r.interview_slot;
    if (r.offer) row.offer = r.offer;
    if (r.feedback) row.feedback = r.feedback;
    snapshot.pairs[r.pair_key] = row;
  }
  snapshot.audit = audit.rows.map((r): AuditEntry => ({
    id: r.id,
    at: new Date(r.at).toISOString(),
    actor: r.actor,
    action: r.action,
    needId: r.need_id,
    talentId: r.talent_id,
    from: r.from_status,
    to: r.to_status,
    reason: r.reason,
    ...(r.note && { note: r.note }),
  }));
  for (const r of cards.rows) {
    if (r.kind === "need") snapshot.needs.push(r.data as Need);
    else snapshot.talent.push(r.data as Talent);
  }
  return { version: Number(meta.rows[0]?.version ?? 0), snapshot };
}

export async function readVersion() {
  const { rows } = await db().query(`SELECT version FROM demo_state_meta WHERE id = 1`);
  return Number(rows[0]?.version ?? 0);
}

/** Has anything ever been saved? An empty database gets the demo's starting state first. */
export async function isEmpty() {
  const { rows } = await db().query(
    `SELECT (SELECT count(*) FROM pipeline_pairs) + (SELECT count(*) FROM pipeline_audit)
          + (SELECT count(*) FROM demo_cards) AS n`,
  );
  return Number(rows[0].n) === 0;
}

/** Apply a validated patch in one transaction; returns the new version. */
export async function writePatch(p: Patch): Promise<number> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const upserts = Object.entries(p.pairs).filter(([, r]) => r);
    const deletes = Object.entries(p.pairs)
      .filter(([, r]) => !r)
      .map(([k]) => k);
    if (upserts.length)
      await client.query(
        `INSERT INTO pipeline_pairs (pair_key, need_id, talent_id, decision, opt_in, screening, interview_slot, offer, feedback, updated_at)
         SELECT r.key, split_part(r.key, '::', 1), split_part(r.key, '::', 2),
                r.row->'decision', r.row->'optIn', r.row->'screening', r.row->>'slot', r.row->'offer', r.row->'feedback', now()
           FROM jsonb_to_recordset($1::jsonb) AS r(key text, row jsonb)
         ON CONFLICT (pair_key) DO UPDATE SET
           decision = EXCLUDED.decision, opt_in = EXCLUDED.opt_in, screening = EXCLUDED.screening,
           interview_slot = EXCLUDED.interview_slot, offer = EXCLUDED.offer, feedback = EXCLUDED.feedback,
           updated_at = now()`,
        [JSON.stringify(upserts.map(([key, row]) => ({ key, row })))],
      );
    if (deletes.length) await client.query(`DELETE FROM pipeline_pairs WHERE pair_key = ANY($1)`, [deletes]);
    if (p.audit.length)
      await client.query(
        `INSERT INTO pipeline_audit (id, at, actor, action, need_id, talent_id, from_status, to_status, reason, note)
         SELECT id, at, actor, action, "needId", "talentId", "from", "to", reason, note
           FROM jsonb_to_recordset($1::jsonb) AS e(id text, at timestamptz, actor text, action text, "needId" text,
                "talentId" text, "from" text, "to" text, reason text, note text)
         ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify(p.audit)],
      );
    const cards = [
      ...p.needs.map((data) => ({ id: data.id, kind: "need", data })),
      ...p.talent.map((data) => ({ id: data.id, kind: "talent", data })),
    ];
    if (cards.length)
      await client.query(
        `INSERT INTO demo_cards (id, kind, data, updated_at)
         SELECT id, kind, data, now() FROM jsonb_to_recordset($1::jsonb) AS c(id text, kind text, data jsonb)
         ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, data = EXCLUDED.data, updated_at = now()`,
        [JSON.stringify(cards)],
      );
    const { rows } = await client.query(
      `UPDATE demo_state_meta SET version = version + 1 WHERE id = 1 RETURNING version`,
    );
    await client.query("COMMIT");
    return Number(rows[0]?.version ?? 0);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Demo reset: empty the demo tables (seed tables are untouched). Returns the new version. */
export async function clearState(): Promise<number> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE pipeline_pairs, pipeline_audit, demo_cards, candidate_profiles");
    const { rows } = await client.query(
      `UPDATE demo_state_meta SET version = version + 1 WHERE id = 1 RETURNING version`,
    );
    await client.query("COMMIT");
    return Number(rows[0]?.version ?? 0);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
