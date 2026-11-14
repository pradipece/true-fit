import { cacheLife } from "next/cache";
import { SEED_NEEDS } from "@/lib/data";
import { preGeneratedSchedule } from "@/lib/schedule";

/**
 * The pre-generated event schedule (slots and rooms) as JSON. Deterministic, so it is
 * prerendered at build time and served as a static file: the event-start login rush
 * never reaches server code. Bookings are per pair and live elsewhere.
 */
export async function GET() {
  return Response.json(await schedule());
}

async function schedule() {
  "use cache";
  cacheLife("days");
  return { ...preGeneratedSchedule(SEED_NEEDS), generatedFor: "build" };
}
