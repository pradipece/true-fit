import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { supabaseDbConfig } from "@/lib/db-config.mjs";
import { SEED } from "@/lib/seed";

/**
 * Round trip: data/ → `yarn db:sql` → Postgres (in-memory PGlite) → getSeed().
 * What the app reads from Supabase must equal what it would read from the JSON seeds.
 */

const pg = new PGlite();
const state = { configured: true, fail: false };

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
vi.mock("@/lib/db", () => ({
  dbConfigured: () => state.configured,
  db: () => ({
    query: (text: string) => {
      if (state.fail) throw new Error("Connection terminated due to connection timeout");
      return pg.query(text);
    },
  }),
}));

const { getSeed } = await import("@/lib/seed-db");

beforeAll(async () => {
  const out = join(mkdtempSync(join(tmpdir(), "truefit-sql-")), "migrate.sql");
  execFileSync("node", ["scripts/db/migrate.mjs", "--sql", out, "--no-scraped"], { stdio: "ignore" });
  const sql = readFileSync(out, "utf8");
  await pg.exec(sql);
  await pg.exec(sql); // the migration must be safe to rerun
}, 60_000);

describe("Supabase seed source", () => {
  it("reads back exactly the JSON seeds, in the same order", async () => {
    const seed = await getSeed();
    expect(seed.source).toBe("supabase");
    expect(seed.companies).toEqual(SEED.companies);
    expect(seed.needs).toEqual(SEED.needs);
    expect(seed.talent).toEqual(SEED.talent);
  });

  it("keeps protected attributes in their own table", async () => {
    const cols = await pg.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'talent'`,
    );
    const names = cols.rows.map((r) => r.column_name);
    for (const f of ["origin", "education", "path"]) expect(names).not.toContain(f);
  });

  it("locks every table behind row-level security with no policies", async () => {
    const tables = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT relname, relrowsecurity FROM pg_class
        WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace`,
    );
    expect(tables.rows.length).toBeGreaterThanOrEqual(15);
    for (const t of tables.rows) expect(t, t.relname).toMatchObject({ relrowsecurity: true });
    const policies = await pg.query(`SELECT 1 FROM pg_policies WHERE schemaname = 'public'`);
    expect(policies.rows).toHaveLength(0);

    // What Supabase's publishable key maps to: a non-owner role sees no rows.
    await pg.exec(`CREATE ROLE anon; GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;`);
    await pg.exec(`SET ROLE anon`);
    const seen = await pg.query(`SELECT * FROM talent`);
    await pg.exec(`RESET ROLE`);
    expect(seen.rows).toHaveLength(0);
  });

  it("falls back to the JSON seeds when Supabase is unreachable or not configured", async () => {
    state.fail = true;
    const down = await getSeed();
    expect(down.source).toBe("json");
    expect(down.reason).toMatch(/timeout/);
    expect(down.talent).toEqual(SEED.talent);
    state.fail = false;

    state.configured = false;
    expect((await getSeed()).source).toBe("json");
    state.configured = true;
  });
});

describe("Supabase connection config", () => {
  const env = {
    SUPABASE_URL: "https://abcdefgh.supabase.co",
    SUPABASE_DATABASE_PASSWORD: "pw",
    SUPABASE_POOLER_HOST: "aws-1-eu-west-2.pooler.supabase.com",
  };

  it("connects through the session pooler as postgres.<ref>, always verifying TLS", () => {
    const c = supabaseDbConfig(env);
    expect(c).toMatchObject({ host: env.SUPABASE_POOLER_HOST, port: 5432, user: "postgres.abcdefgh" });
    expect(c?.ssl).toMatchObject({ rejectUnauthorized: true });
    expect(String((c?.ssl as { ca: string }).ca)).toContain("BEGIN CERTIFICATE");
  });

  it("drops sslmode from a full URL so it can't turn verification off", () => {
    const c = supabaseDbConfig({ SUPABASE_DATABASE_URL: "postgres://u:p@h:5432/postgres?sslmode=require" });
    expect(c?.connectionString).not.toContain("sslmode");
    expect(c?.ssl).toMatchObject({ rejectUnauthorized: true });
  });

  it("is off until the variables are set", () => {
    expect(supabaseDbConfig({})).toBeNull();
    expect(supabaseDbConfig({ ...env, SUPABASE_POOLER_HOST: undefined })).toBeNull();
  });
});
