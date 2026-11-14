import { describe, expect, it } from "vitest";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { pairKey } from "@/lib/match";
import { participants } from "@/lib/participants";
import {
  agendaFor,
  agendaIcs,
  earliestFree,
  generateSlots,
  pairStatus,
  preGeneratedSchedule,
  rooms,
  screeningAvailability,
  SLOT_TIMES,
  slotAvailability,
  withOptIn,
} from "@/lib/schedule";

const k = (n: string, t: string) => pairKey(n, t);
const sameCompany = SEED_NEEDS.filter(
  (n) =>
    n.companyId ===
    SEED_NEEDS.find((x) => SEED_NEEDS.filter((y) => y.companyId === x.companyId).length > 1)?.companyId,
);

describe("pre-generated schedule", () => {
  it("generates 10-minute slots from 10:00 to 11:50", () => {
    expect(SLOT_TIMES).toHaveLength(12);
    expect(SLOT_TIMES[0]).toBe("10:00");
    expect(SLOT_TIMES.at(-1)).toBe("11:50");
    expect(generateSlots("09:00", "09:30", 15)).toEqual(["09:00", "09:15"]);
  });

  it("gives every company one stable table or online room", () => {
    const r = rooms(SEED_NEEDS);
    expect(new Set(r.map((x) => x.companyId)).size).toBe(r.length);
    expect(new Set(r.map((x) => x.label)).size).toBe(r.length);
    expect(rooms(SEED_NEEDS)).toEqual(r);
    expect(preGeneratedSchedule(SEED_NEEDS).rooms.every((x) => x.slots.length === 12)).toBe(true);
  });

  it("prerenders an agenda for every company and candidate", () => {
    const ids = participants().map((p) => p.id);
    for (const t of SEED_TALENT) expect(ids).toContain(t.id);
    for (const r of rooms(SEED_NEEDS)) expect(ids).toContain(r.companyId);
    expect(ids).toContain("T-YOU");
  });
});

describe("slot clashes are per company and per candidate only", () => {
  it("lets unrelated pairs share a time", () => {
    const [a, b] = SEED_NEEDS.filter((n, i, all) => all.findIndex((x) => x.companyId === n.companyId) === i);
    const slots = { [k(a.id, "T-01")]: "10:00" };
    const s = slotAvailability(k(b.id, "T-02"), slots, SEED_NEEDS);
    expect(s[0]).toMatchObject({ time: "10:00", free: true });
  });

  it("blocks a time when the candidate is already booked", () => {
    const [a, b] = SEED_NEEDS.filter((n, i, all) => all.findIndex((x) => x.companyId === n.companyId) === i);
    const s = slotAvailability(k(b.id, "T-01"), { [k(a.id, "T-01")]: "10:00" }, SEED_NEEDS);
    expect(s[0]).toMatchObject({ free: false, reason: "candidate" });
    expect(earliestFree(s)).toBe("10:10");
  });

  it("blocks a time when the company's table is already booked", () => {
    if (sameCompany.length < 2) return; // seeds have one company with two needs
    const [a, b] = sameCompany;
    const s = slotAvailability(k(b.id, "T-02"), { [k(a.id, "T-01")]: "10:20" }, SEED_NEEDS);
    expect(s[2]).toMatchObject({ time: "10:20", free: false, reason: "company" });
  });
});

describe("mutual opt-in", () => {
  const key = k("N-01", "T-30");

  it("needs a yes from both sides; a decline from either stops it", () => {
    expect(pairStatus({ company: true }, undefined)).toBe("waiting");
    expect(pairStatus({ company: true, talent: true }, undefined)).toBe("mutual");
    expect(pairStatus({ company: true, talent: true }, "10:00")).toBe("booked");
    expect(pairStatus({ company: true, talent: false }, undefined)).toBe("declined");
  });

  it("releases a booked slot when either side withdraws or declines", () => {
    const optIns = { [key]: { company: true, talent: true } };
    const slots = { [key]: "10:00" };
    expect(withOptIn(optIns, slots, key, "talent", undefined).slots).toEqual({});
    expect(withOptIn(optIns, slots, key, "company", false).slots).toEqual({});
    expect(withOptIn(optIns, slots, key, "company", true).slots).toEqual(slots);
  });
});

const approved = (...keys: string[]) =>
  Object.fromEntries(keys.map((key) => [key, { status: "approved" as const, reason: "x", at: "" }]));
const passed = (slot = "10:00") => ({ answer: true, slot, result: "passed" as const });
const pipe = (s: Partial<Parameters<typeof agendaFor>[1]>) => ({
  needs: SEED_NEEDS,
  talent: SEED_TALENT,
  decisions: {},
  optIns: {},
  slots: {},
  screening: {},
  offers: {},
  ...s,
});

describe("Espoo interview comes first", () => {
  const key = k("N-01", "T-30");
  const company = { kind: "company" as const, id: SEED_NEEDS.find((n) => n.id === "N-01")!.companyId! };

  it("keeps the candidate off the company's agenda until Espoo passes them", () => {
    const invited = pipe({ decisions: approved(key), screening: { [key]: { answer: true, slot: "10:00" } } });
    expect(agendaFor(company, invited)).toEqual([]);
    expect(agendaFor({ kind: "talent", id: "T-30" }, invited)[0]).toMatchObject({
      kind: "espoo",
      time: "10:00",
    });
    const shared = pipe({ decisions: approved(key), screening: { [key]: passed() } });
    expect(agendaFor(company, shared)[0]).toMatchObject({
      bucket: "answer",
      counterpart: expect.any(String),
    });
  });

  it("books the company interview only after the Espoo interview, never at a clashing time", () => {
    const s = slotAvailability(key, {}, SEED_NEEDS, { [key]: passed("10:20") });
    expect(s.slice(0, 3).map((x) => x.reason)).toEqual(["order", "order", "candidate"]);
    expect(earliestFree(s)).toBe("10:30");
    const other = k("N-02", "T-30");
    const espoo = screeningAvailability(other, { [key]: "10:40" }, { [key]: passed("10:20") });
    expect(espoo.find((x) => x.time === "10:20")).toMatchObject({ free: false, reason: "candidate" });
    expect(espoo.find((x) => x.time === "10:40")).toMatchObject({ free: false });
  });
});

describe("agenda", () => {
  it("lists booked meetings first, by time, then pending ones", () => {
    const a = k("N-01", "T-30");
    const b = k("N-02", "T-30");
    const c = k("N-03", "T-30");
    const both = { company: true, talent: true };
    const items = agendaFor(
      { kind: "talent", id: "T-30" },
      pipe({
        decisions: approved(a, b, c),
        screening: { [a]: passed("10:00"), [b]: passed("10:10") },
        optIns: { [a]: both, [b]: both },
        slots: { [a]: "11:00", [b]: "10:30" },
      }),
    );
    expect(items.map((i) => i.bucket)).toEqual(["booked", "booked", "booked", "booked", "answer"]);
    expect(items.map((i) => i.time).slice(0, 4)).toEqual(["10:00", "10:10", "10:30", "11:00"]);
    expect(items[0].room).toBeTruthy();
  });

  it("exports booked meetings as an iCalendar file", () => {
    const key = k("N-01", "T-30");
    const items = agendaFor(
      { kind: "talent", id: "T-30" },
      pipe({
        decisions: approved(key),
        screening: { [key]: passed("10:00") },
        optIns: { [key]: { company: true, talent: true } },
        slots: { [key]: "10:40" },
      }),
    ).filter((i) => i.kind === "company");
    const ics = agendaIcs(items, "Candidate T-30");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;TZID=Europe/Helsinki:20261203T104000");
    expect(ics).toContain("DTEND;TZID=Europe/Helsinki:20261203T105000");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
