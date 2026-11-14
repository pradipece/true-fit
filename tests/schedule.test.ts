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

  it("hides the candidate's name from the company until both say yes", () => {
    const t = SEED_TALENT.find((x) => x.id === "T-30")!;
    const company = { kind: "company" as const, id: SEED_NEEDS.find((n) => n.id === "N-01")!.companyId! };
    const before = agendaFor(company, [key], SEED_NEEDS, SEED_TALENT, { [key]: { company: true } }, {});
    expect(before[0].counterpart).toBe(t.alias);
    const after = agendaFor(
      company,
      [key],
      SEED_NEEDS,
      SEED_TALENT,
      { [key]: { company: true, talent: true } },
      { [key]: "10:30" },
    );
    expect(after[0]).toMatchObject({ counterpart: t.revealName, time: "10:30", status: "booked" });
  });
});

describe("agenda", () => {
  it("lists booked meetings first, by time, then pending ones", () => {
    const a = k("N-01", "T-30");
    const b = k("N-02", "T-30");
    const c = k("N-03", "T-30");
    const items = agendaFor(
      { kind: "talent", id: "T-30" },
      [a, b, c],
      SEED_NEEDS,
      SEED_TALENT,
      { [a]: { company: true, talent: true }, [b]: { company: true, talent: true }, [c]: { company: true } },
      { [a]: "11:00", [b]: "10:10" },
    );
    expect(items.map((i) => i.status)).toEqual(["booked", "booked", "waiting"]);
    expect(items[0].time).toBe("10:10");
    expect(items[0].room).toBeTruthy();
  });

  it("exports booked meetings as an iCalendar file", () => {
    const key = k("N-01", "T-30");
    const items = agendaFor(
      { kind: "talent", id: "T-30" },
      [key],
      SEED_NEEDS,
      SEED_TALENT,
      { [key]: { company: true, talent: true } },
      { [key]: "10:40" },
    );
    const ics = agendaIcs(items, "Candidate T-30");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART;TZID=Europe/Helsinki:20261203T104000");
    expect(ics).toContain("DTEND;TZID=Europe/Helsinki:20261203T105000");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
