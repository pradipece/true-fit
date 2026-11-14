import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { dbConfig, supabaseDbConfig, tigerDbConfig } from "@/lib/db-config.mjs";
import { ESCO, SEED } from "./fixtures";

/**
 * Round trip: a snapshot (tests/fixtures) → `yarn db:sql --from` → Postgres (in-memory
 * PGlite) → getSeed() / getEsco(). What the app reads must equal the snapshot exactly.
 */

const pg = new PGlite();
const state = { configured: true, fail: false };

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));
// Outside a request there is no connection() to wait for.
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/db", () => ({
  dbConfigured: () => state.configured,
  dbProvider: () => (state.configured ? "Tiger Data" : null),
  db: () => ({
    query: (text: string) => {
      if (state.fail) throw new Error("Connection terminated due to connection timeout");
      return pg.query(text);
    },
  }),
}));

const { getEsco, getSeed } = await import("@/lib/seed-db");

beforeAll(async () => {
  const out = join(mkdtempSync(join(tmpdir(), "truefit-sql-")), "migrate.sql");
  execFileSync("node", ["scripts/db/migrate.mjs", "--sql", out, "--from", "tests/fixtures"], {
    stdio: "ignore",
  });
  const sql = readFileSync(out, "utf8");
  await pg.exec(sql);
  await pg.exec(sql); // the migration must be safe to rerun
}, 60_000);

describe("Database seed source", () => {
  it("reads back exactly the ESCO snapshot, in the same order", async () => {
    const esco = await getEsco();
    const strip = <T extends object>(o: T) => {
      const { $comment, ...rest } = JSON.parse(JSON.stringify(o));
      void $comment;
      return rest;
    };
    expect(esco.skills).toEqual(strip(ESCO.skills));
    expect(esco.occupations).toEqual(strip(ESCO.occupations));
  });

  it("reads back exactly the seed snapshot, in the same order", async () => {
    const seed = await getSeed();
    expect(seed.source).toBe("database");
    expect(seed.provider).toBe("Tiger Data");
    expect(seed.companies).toEqual(SEED.companies);
    expect(seed.needs).toEqual(SEED.needs);
    expect(seed.talent).toEqual(SEED.talent);
  });

  it("candidate-only SQL replaces the talent tables and reads back the same, with full names", async () => {
    const out = join(mkdtempSync(join(tmpdir(), "truefit-sql-")), "talent.sql");
    execFileSync(
      "node",
      ["scripts/db/migrate.mjs", "--talent-only", "--sql", out, "--from", "tests/fixtures"],
      { stdio: "ignore" },
    );
    const sql = readFileSync(out, "utf8");
    expect(sql).not.toMatch(/TRUNCATE (esco|companies)/);
    await pg.exec(sql);
    await pg.exec(sql); // safe to rerun
    const seed = await getSeed();
    expect(seed.source).toBe("database");
    expect(seed.provider).toBe("Tiger Data");
    expect(seed.talent).toEqual(SEED.talent);
    expect(seed.needs).toEqual(SEED.needs);
    for (const t of seed.talent) expect(t.revealName).toBe(t.contact?.fullName);
  });

  it("keeps protected attributes in their own table", async () => {
    const cols = await pg.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'talent'`,
    );
    const names = cols.rows.map((r) => r.column_name);
    for (const f of ["origin", "education", "path"]) expect(names).not.toContain(f);
  });

  it("keeps mock contact details in their own table, one row per candidate", async () => {
    const cols = await pg.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'talent'`,
    );
    const names = cols.rows.map((r) => r.column_name);
    for (const f of ["full_name", "email", "phone", "city"]) expect(names).not.toContain(f);
    const rows = await pg.query<{ talent_id: string; email: string }>(
      `SELECT talent_id, email FROM talent_contact`,
    );
    expect(rows.rows).toHaveLength(SEED.talent.length);
    for (const r of rows.rows) expect(r.email).toMatch(/@example\.com$/);
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

  it("has no local fallback: an unreachable database is an error", async () => {
    state.fail = true;
    await expect(getSeed()).rejects.toThrow(/timeout/);
    state.fail = false;
  });

  it("never reads the database during a build (next build sets NEXT_PHASE)", async () => {
    const { readSeed } = await import("@/lib/db-read.mjs");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    try {
      await expect(readSeed({ query: () => pg.query("SELECT 1") })).rejects.toThrow(
        /not read during the build/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("refuses to write SQL without a snapshot to load", () => {
    expect(() =>
      execFileSync("node", ["scripts/db/migrate.mjs", "--sql", join(tmpdir(), "x.sql")], { stdio: "pipe" }),
    ).toThrow(/--from/);
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

describe("Tiger Data connection config", () => {
  const url = "postgres://tsdbadmin:pw@abc123.xyz.tsdb.cloud.timescale.com:31633/tsdb?sslmode=require";

  it("verifies TLS and drops sslmode=require, which would skip the certificate check", () => {
    const c = tigerDbConfig({ TIGER_DATABASE_URL: url });
    expect(c?.connectionString).not.toContain("sslmode");
    expect(c?.connectionString).toContain("tsdb.cloud.timescale.com:31633/tsdb");
    expect(c?.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("takes the password from TIGER_DATABASE_PASSWORD over the one in the URL", () => {
    const c = tigerDbConfig({ TIGER_DATABASE_URL: url, TIGER_DATABASE_PASSWORD: "s3cr3t/+" });
    expect(new URL(c!.connectionString!).password).toBe(encodeURIComponent("s3cr3t/+"));
    const bare = tigerDbConfig({
      TIGER_DATABASE_URL: url.replace(":pw@", "@"),
      TIGER_DATABASE_PASSWORD: "x",
    });
    expect(new URL(bare!.connectionString!).password).toBe("x");
  });

  it("is preferred over Supabase when both are configured", () => {
    const supabase = { SUPABASE_DATABASE_URL: "postgres://u:p@h:5432/postgres" };
    expect(dbConfig({ ...supabase, TIGER_DATABASE_URL: url })?.provider).toBe("Tiger Data");
    expect(dbConfig(supabase)?.provider).toBe("Supabase");
    expect(dbConfig({})).toBeNull();
  });
});
