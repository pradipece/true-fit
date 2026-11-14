import { Pool } from "pg";
import { supabaseDbConfig } from "./db-config.mjs";

/**
 * Supabase Postgres connection pool, server-only (connection settings and TLS:
 * lib/db-config.mjs). Without Supabase configured the app runs on the JSON seeds in data/.
 * Tables have row-level security with no policies, so this server connection is the
 * only way in: the publishable key gets nothing.
 */

export const dbConfigured = () => supabaseDbConfig() !== null;

const globalForDb = globalThis as unknown as { supabasePool?: Pool };

export function db(): Pool {
  if (globalForDb.supabasePool) return globalForDb.supabasePool;
  const config = supabaseDbConfig();
  if (!config) throw new Error("Supabase database is not configured");
  const pool = new Pool({
    ...config,
    // The session pooler allows few clients per project; the app only needs a couple.
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30_000,
    query_timeout: 8000,
  });
  // An idle client dropping (network blip, project pause) must not crash the server.
  pool.on("error", (err) => console.warn("[supabase] idle client error:", err.message));
  // Reuse one pool across hot reloads in dev.
  globalForDb.supabasePool = pool;
  return pool;
}
