import { Pool } from "pg";
import { dbConfig } from "./db-config.mjs";

/**
 * Postgres connection pool, server-only: Tiger Data when TIGER_DATABASE_URL is set, else
 * Supabase (connection settings and TLS: lib/db-config.mjs). Without either the app runs
 * on the JSON seeds in data/. On Supabase the tables have row-level security with no
 * policies, so this server connection is the only way in: the publishable key gets nothing.
 */

export const dbConfigured = () => dbConfig() !== null;

/** "Tiger Data", "Supabase", or null when no database is configured. */
export const dbProvider = () => dbConfig()?.provider ?? null;

const globalForDb = globalThis as unknown as { dbPool?: Pool };

export function db(): Pool {
  if (globalForDb.dbPool) return globalForDb.dbPool;
  const selected = dbConfig();
  if (!selected) throw new Error("No database is configured");
  const pool = new Pool({
    ...selected.config,
    // Supabase's session pooler allows few clients per project; the app only needs a couple.
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    query_timeout: 8000,
  });
  // An idle client dropping (network blip, service pause) must not crash the server.
  const label = selected.provider.toLowerCase().replace(" ", "-");
  pool.on("error", (err) => console.warn(`[${label}] idle client error:`, err.message));
  // Reuse one pool across hot reloads in dev.
  globalForDb.dbPool = pool;
  return pool;
}
