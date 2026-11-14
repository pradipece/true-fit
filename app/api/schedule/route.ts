import { cacheLife } from "next/cache";
import { preGeneratedSchedule } from "@/lib/schedule";
import { cachedSeed, getSeed } from "@/lib/seed-db";

/**
 * The pre-generated event schedule (slots and rooms) as JSON. Deterministic and cached for
 * days, so the event-start login rush is served from the cache rather than the database.
 * Built on the first request, not at build time: the build never reads the database.
 * Bookings are per pair and live elsewhere.
 */
export async function GET() {
  await getSeed(); // request time: the build never reads the database (lib/seed-db.ts)
  return Response.json(await schedule());
}

async function schedule() {
  "use cache";
  cacheLife("days");
  const { needs } = await cachedSeed();
  return { ...preGeneratedSchedule(needs), generatedFor: "server" };
}
