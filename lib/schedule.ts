import { COMPANIES, EVENT } from "./data";
import { modeKind } from "./need-terms";
import type { Need, Talent } from "./types";

/**
 * Event schedule: slots and rooms are pre-generated from the event config, so nothing
 * has to be computed per request when everyone logs in at the start of the event.
 * Bookings are the only per-pair state. A slot clashes only with the same company's
 * table or the same candidate, never with unrelated meetings.
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

/** All slot start times between start (inclusive) and end (exclusive). */
export function generateSlots(start = EVENT.start, end = EVENT.end, minutes = EVENT.slotMinutes) {
  const out: string[] = [];
  for (let t = toMinutes(start); t + minutes <= toMinutes(end); t += minutes) out.push(toTime(t));
  return out;
}

export const SLOT_TIMES = generateSlots();

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
    const name = COMPANIES.find((c) => c.id === id)?.name ?? own[0]?.company ?? "Your company";
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

export type SlotState = { time: string; free: boolean; mine: boolean; reason?: "company" | "candidate" };

/** Which slots this pair can book: busy only if the same company or the same candidate is booked. */
export function slotAvailability(key: string, slots: Record<string, string>, needs: Need[]): SlotState[] {
  const { needId, talentId } = parse(key);
  const need = needs.find((n) => n.id === needId);
  const company = need ? companyOf(need) : "";
  const others = Object.entries(slots).filter(([k]) => k !== key);
  return SLOT_TIMES.map((time) => {
    const at = others.filter(([, t]) => t === time).map(([k]) => parse(k));
    const companyBusy = at.some((p) => {
      const n = needs.find((x) => x.id === p.needId);
      return n && companyOf(n) === company;
    });
    const candidateBusy = at.some((p) => p.talentId === talentId);
    return {
      time,
      mine: slots[key] === time,
      free: !companyBusy && !candidateBusy,
      reason: companyBusy ? "company" : candidateBusy ? "candidate" : undefined,
    };
  });
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
  needTitle: string;
  company: string;
  /** The other side: a revealed name only after both opted in. */
  counterpart: string;
  status: PairStatus;
  time?: string;
  room?: string;
  myAnswer: OptInAnswer;
};

export function agendaFor(
  who: Participant,
  approvedKeys: string[],
  needs: Need[],
  talent: Talent[],
  optIns: Record<string, OptIn>,
  slots: Record<string, string>,
): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const key of approvedKeys) {
    const { needId, talentId } = parse(key);
    const need = needs.find((n) => n.id === needId);
    const t = talent.find((x) => x.id === talentId);
    if (!need || !t) continue;
    const mine = who.kind === "company" ? companyOf(need) === who.id : talentId === who.id;
    if (!mine) continue;
    const o = optIns[key];
    const status = pairStatus(o, slots[key]);
    const revealed = status === "mutual" || status === "booked";
    items.push({
      key,
      needTitle: need.title,
      company: need.company,
      counterpart: who.kind === "company" ? (revealed ? t.revealName : t.alias) : need.company,
      status,
      time: status === "booked" ? slots[key] : undefined,
      room: status === "booked" ? roomFor(need, needs).label : undefined,
      myAnswer: o?.[who.kind],
    });
  }
  const order: Record<PairStatus, number> = { booked: 0, mutual: 1, waiting: 2, declined: 3 };
  return items.sort(
    (a, b) => order[a.status] - order[b.status] || (a.time ?? "").localeCompare(b.time ?? ""),
  );
}

/** iCalendar file for the booked meetings, so people can add them to their own calendar. */
export function agendaIcs(items: AgendaItem[], ownerName: string) {
  const date = EVENT.isoDate.replaceAll("-", "");
  const stamp = (t: string) => `${date}T${t.replace(":", "")}00`;
  const end = (t: string) => toTime(toMinutes(t) + EVENT.slotMinutes);
  const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);
  const events = items
    .filter((i) => i.time)
    .map((i) =>
      [
        "BEGIN:VEVENT",
        `UID:${i.key.replace("::", "-")}@truefit.demo`,
        `DTSTART;TZID=Europe/Helsinki:${stamp(i.time!)}`,
        `DTEND;TZID=Europe/Helsinki:${stamp(end(i.time!))}`,
        `SUMMARY:${esc(`${EVENT.slotMinutes}-min meeting: ${i.needTitle} · ${i.counterpart}`)}`,
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
