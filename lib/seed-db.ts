import { cacheLife, cacheTag } from "next/cache";
import { db, dbProvider } from "./db";
import { readEsco, readSeed } from "./db-read.mjs";
import { setEsco, type EscoSnapshot } from "./esco";
import { loadSeed, setSeed, type RawSeed, type Seed } from "./seed";

/**
 * Server-side data source: the ESCO subset and the synthetic seeds (companies, needs,
 * talent), read from the database (Tiger Data, else Supabase; see lib/db.ts). There is no
 * local copy and no fallback: without a reachable database these throw, and the page shows
 * its error boundary. Load or restore data with `yarn db:migrate --from <dir>`.
 *
 * Reads are cached ("use cache"); each call also fills the in-memory registries
 * (lib/esco.ts, lib/seed.ts) that the matching and AI helpers read synchronously, so a
 * server component or route handler only has to await getSeed() (or getEsco()) first.
 */

export type LoadedSeed = Seed & {
  source: "database";
  /** Which database the rows came from ("Tiger Data" | "Supabase"). */
  provider?: string;
};

async function cachedEsco(): Promise<EscoSnapshot> {
  "use cache";
  cacheTag("esco");
  cacheLife("hours");
  return (await readEsco(db())) as EscoSnapshot;
}

async function cachedSeed(): Promise<LoadedSeed> {
  "use cache";
  cacheTag("seed");
  cacheLife("hours");
  // Validation checks skill ids against the ESCO registry.
  setEsco(await cachedEsco());
  const seed = loadSeed((await readSeed(db())) as RawSeed);
  return { ...seed, source: "database", provider: dbProvider() ?? undefined };
}

/** The ESCO subset, and fills the ESCO registry. */
export async function getEsco(): Promise<EscoSnapshot> {
  const esco = await cachedEsco();
  setEsco(esco);
  return esco;
}

/** Companies, needs and talent, and fills both the ESCO and the seed registries. */
export async function getSeed(): Promise<LoadedSeed> {
  const [esco, seed] = await Promise.all([cachedEsco(), cachedSeed()]);
  setEsco(esco);
  setSeed(seed);
  return seed;
}
