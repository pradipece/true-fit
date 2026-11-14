import { COMPANIES, EVENT, OWN_COMPANY } from "./data";
import { modeKind } from "./need-terms";
import { activeKeys, myTurn, ownedBy, stageOf, visibleTo, type PipelineState } from "./pipeline";
import type { Need, Talent } from "./types";

/**
 * Interview schedule: slots run across the interview work week (Mon–Fri, office hours,
 * lib/data.ts EVENT) and are pre-generated, so nothing is computed per request. A slot is
 * "YYYY-MM-DD HH:MM", so plain string order is time order. Bookings are the only per-pair
 * state. A slot clashes only with the same company or the same candidate.
 */

export type OptIn = { company?: boolean; talent?: boolean };
/** yes = opted in, no = declined, undefined = not answered yet. */
export type OptInAnswer = boolean | undefined;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Start times in one day between start (inclusive) and end (exclusive). */
export function dayTimes(start = EVENT.start, end = EVENT.end, minutes = EVENT.slotMinutes) {
  const out: string[] = [];
  for (let t = toMinutes(start); t + minutes <= toMinutes(end); t += minutes) out.push(toTime(t));
  return out;
}

/** Every slot of the interview week, "YYYY-MM-DD HH:MM", in time order. */
export function generateSlots(days = EVENT.days, times = dayTimes()) {
  return days.flatMap((d) => times.map((t) => `${d} ${t}`));
}

export const SLOT_TIMES = generateSlots();

/** Bookings saved before the work week ("10:20") count as the week's first day. */
export const normSlot = (s: string) => (/^\d{2}:\d{2}$/.test(s) ? `${EVENT.days[0]} ${s}` : s);
export const slotDay = (s: string) => normSlot(s).slice(0, 10);
export const slotTime = (s: string) => normSlot(s).slice(11);
/** "Mon 30 Nov" for "2026-11-30" (fixed locale and UTC, so server and browser agree). */
export const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
/** "Mon 30 Nov, 10:30". */
export const slotLabel = (s: string) => `${dayLabel(slotDay(s))}, ${slotTime(s)}`;

export type Room = { companyId: string; company: string; label: string; online: boolean };

/** Company id for a need; needs submitted in the demo get one shared id. */
export const companyOf = (n: Pick<Need, "companyId">) => n.companyId ?? "C-YOU";

/** One table per company on site, or an online room if all of its needs are remote. Stable order. */
export function rooms(needs: Need[]): Room[] {
  const ids = [...new Set([...COMPANIES.map((c) => c.id), ...needs.map(companyOf)])];
  let table = 0;
  let online = 0;
  return ids.map((id) => {
    const own = needs.filter((n) => companyOf(n) === id);
    const name = COMPANIES.find((c) => c.id === id)?.name ?? own[0]?.company ?? OWN_COMPANY.name;
    const remote = own.length > 0 && own.every((n) => modeKind(n.mode) === "Remote");
    return {
      companyId: id,
      company: name,
      online: remote,
      label: remote ? `Online room ${++online}` : `Table ${++table}, Otaniemi hall`,
    };
  });
}

export const roomFor = (need: Need, needs: Need[]) =>
  rooms(needs).find((r) => r.companyId === companyOf(need))!;

/** The whole pre-generated schedule: what the static /api/schedule endpoint serves. */
export function preGeneratedSchedule(needs: Need[]) {
  return {
    event: {
      name: EVENT.name,
      date: EVENT.isoDate,
      start: EVENT.start,
      end: EVENT.end,
      slotMinutes: EVENT.slotMinutes,
    },
    slots: SLOT_TIMES,
    rooms: rooms(needs).map((r) => ({ ...r, slots: SLOT_TIMES })),
  };
}

const parse = (key: string) => {
  const [needId, talentId] = key.split("::");
  return { needId, talentId };
};

export type SlotState = {
  time: string;
  free: boolean;
  mine: boolean;
  /** Why a time is blocked: the company's table, the candidate, or it isn't after the Espoo interview. */
  reason?: "company" | "candidate" | "order";
};

/** Every time this candidate is already booked: company interviews and Espoo interviews. */
function candidateTimes(
  talentId: string,
  slots: Record<string, string>,
  screening: Record<string, { slot?: string }>,
  except: { company?: string; espoo?: string },
) {
  const busy = new Set<string>();
  for (const [k, t] of Object.entries(slots))
    if (k !== except.company && parse(k).talentId === talentId) busy.add(normSlot(t));
  for (const [k, s] of Object.entries(screening))
    if (k !== except.espoo && s.slot && parse(k).talentId === talentId) busy.add(normSlot(s.slot));
  return busy;
}

/**
 * Which company-interview times this pair can book: busy if the same company's table or the
 * same candidate is booked (Espoo interviews included), and only after this pair's Espoo interview.
 */
export function slotAvailability(
  key: string,
  slots: Record<string, string>,
  needs: Need[],
  screening: Record<string, { slot?: string }> = {},
): SlotState[] {
  const { needId, talentId } = parse(key);
  const need = needs.find((n) => n.id === needId);
  const company = need ? companyOf(need) : "";
  const others = Object.entries(slots).filter(([k]) => k !== key);
  const candidate = candidateTimes(talentId, slots, screening, { company: key });
  const after = screening[key]?.slot && normSlot(screening[key].slot!);
  const mineAt = slots[key] && normSlot(slots[key]);
  return SLOT_TIMES.map((time) => {
    const companyBusy = others.some(([k, t]) => {
      if (normSlot(t) !== time) return false;
      const n = needs.find((x) => x.id === parse(k).needId);
      return !!n && companyOf(n) === company;
    });
    const candidateBusy = candidate.has(time);
    const tooEarly = !!after && time <= after;
    return {
      time,
      mine: mineAt === time,
      free: !companyBusy && !candidateBusy && !tooEarly,
      reason: companyBusy ? "company" : candidateBusy ? "candidate" : tooEarly ? "order" : undefined,
    };
  });
}

/** Where Espoo holds its interviews: several interviewers, so only the candidate can clash. */
export const ESPOO_DESK = "Espoo Esbo office, Otaniemi (or online)";

/** Which Espoo-interview times this candidate can book: only their own bookings block a time. */
export function screeningAvailability(
  key: string,
  slots: Record<string, string>,
  screening: Record<string, { slot?: string }>,
): SlotState[] {
  const { talentId } = parse(key);
  const busy = candidateTimes(talentId, slots, screening, { espoo: key });
  const mineAt = screening[key]?.slot && normSlot(screening[key].slot!);
  return SLOT_TIMES.map((time) => ({
    time,
    mine: mineAt === time,
    free: !busy.has(time),
    reason: busy.has(time) ? "candidate" : undefined,
  }));
}

export const earliestFree = (states: SlotState[]) => states.find((s) => s.free && !s.mine)?.time;

/** Record one side's answer. Anything other than a yes releases a booked slot. */
export function withOptIn(
  optIns: Record<string, OptIn>,
  slots: Record<string, string>,
  key: string,
  side: keyof OptIn,
  value: OptInAnswer,
) {
  const next = { ...optIns, [key]: { ...optIns[key], [side]: value } };
  const both = next[key].company === true && next[key].talent === true;
  if (both || !(key in slots)) return { optIns: next, slots };
  const rest = { ...slots };
  delete rest[key];
  return { optIns: next, slots: rest };
}

export type PairStatus = "waiting" | "declined" | "mutual" | "booked";

export function pairStatus(o: OptIn | undefined, slot: string | undefined): PairStatus {
  if (o?.company === false || o?.talent === false) return "declined";
  if (o?.company && o?.talent) return slot ? "booked" : "mutual";
  return "waiting";
}

// ── Agendas ──────────────────────────────────────────────────────────────────

export type Participant = { kind: "company"; id: string } | { kind: "talent"; id: string };

export type AgendaItem = {
  key: string;
  /** An Espoo interview (candidate only) or the company interview. */
  kind: "espoo" | "company";
  needTitle: string;
  company: string;
  /** Who the meeting is with. */
  counterpart: string;
  /** booked = in the calendar; answer / book = this participant's move; waiting = someone else's. */
  bucket: "booked" | "answer" | "book" | "waiting";
  time?: string;
  room?: string;
};

/**
 * One participant's agenda, from the pipeline: booked Espoo and company interviews, plus what
 * they still have to answer or book. Only their own pairs are read; the company sees a pair
 * only once Espoo has passed the candidate.
 */
export function agendaFor(
  who: Participant,
  state: PipelineState & { needs: Need[]; talent: Talent[] },
): AgendaItem[] {
  const { needs, talent, slots, screening } = state;
  const items: AgendaItem[] = [];
  for (const key of activeKeys(state)) {
    const { needId, talentId } = parse(key);
    const need = needs.find((n) => n.id === needId);
    const t = talent.find((x) => x.id === talentId);
    if (!need || !t || !ownedBy(who.kind, who.id, key, needs) || !visibleTo(who.kind, key, state)) continue;
    const p = stageOf(key, state);
    if (p.stopped) continue;
    const base = { key, needTitle: need.title, company: need.company };
    const company = {
      ...base,
      kind: "company" as const,
      counterpart: who.kind === "company" ? t.revealName : need.company,
    };
    if (who.kind === "talent" && screening[key]?.slot)
      items.push({
        ...base,
        kind: "espoo",
        counterpart: "Espoo Esbo interview",
        bucket: "booked",
        time: screening[key].slot,
        room: ESPOO_DESK,
      });
    if (slots[key])
      items.push({ ...company, bucket: "booked", time: slots[key], room: roomFor(need, needs).label });
    if (p.stage === "interview-booked" || p.stage === "offered" || p.hired) continue;
    const espoo = { ...base, kind: "espoo" as const, counterpart: "Espoo Esbo interview" };
    if (p.stage === "invited" || p.stage === "applied")
      items.push({ ...espoo, bucket: myTurn(who.kind, p) ? "answer" : "waiting" });
    else if (p.stage === "screen-to-book") items.push({ ...espoo, bucket: "book" });
    else if (p.stage === "shared" || p.stage === "interview-invited")
      items.push({ ...company, bucket: myTurn(who.kind, p) ? "answer" : "waiting" });
    else if (p.stage === "interview-to-book") items.push({ ...company, bucket: "book" });
  }
  const order = { booked: 0, answer: 1, book: 2, waiting: 3 };
  return items.sort(
    (a, b) =>
      order[a.bucket] - order[b.bucket] || normSlot(a.time ?? "").localeCompare(normSlot(b.time ?? "")),
  );
}

/** iCalendar file for the booked meetings, so people can add them to their own calendar. */
export function agendaIcs(items: AgendaItem[], ownerName: string) {
  const stamp = (s: string) => `${slotDay(s).replaceAll("-", "")}T${slotTime(s).replace(":", "")}00`;
  const end = (s: string) => `${slotDay(s)} ${toTime(toMinutes(slotTime(s)) + EVENT.slotMinutes)}`;
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);
  const events = items
    .filter((i) => i.time)
    .map((i) =>
      [
        "BEGIN:VEVENT",
        `UID:${i.kind}-${i.key.replace("::", "-")}@truefit.demo`,
        `DTSTART;TZID=Europe/Helsinki:${stamp(i.time!)}`,
        `DTEND;TZID=Europe/Helsinki:${stamp(end(i.time!))}`,
        `SUMMARY:${esc(`${EVENT.slotMinutes}-min ${i.kind === "espoo" ? "Espoo interview" : "interview"}: ${i.needTitle} · ${i.counterpart}`)}`,
        `LOCATION:${esc(i.room ?? "")}`,
        "END:VEVENT",
      ].join("\r\n"),
    );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//True Fit//${esc(ownerName)}//EN`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
