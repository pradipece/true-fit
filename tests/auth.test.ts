import { describe, expect, it } from "vitest";
import { authorizePatch } from "@/lib/auth/patch-rbac";
import { access, can } from "@/lib/auth/rbac";
import { signSession, verifySession } from "@/lib/auth/session";
import { EMPTY_SNAPSHOT, type Patch, type Snapshot } from "@/lib/demo-state";
import { SEED_NEEDS } from "@/lib/data";
import type { Need } from "@/lib/types";

const need = SEED_NEEDS.find((n) => n.id === "N-01")!;
const company = need.companyId!;
const otherCompany = SEED_NEEDS.find((n) => n.companyId !== company)!.companyId!;
const key = `N-01::T-30`;
const patch = (p: Partial<Patch>): Patch => ({ pairs: {}, audit: [], needs: [], talent: [], ...p });
const snap = (s: Partial<Snapshot>): Snapshot => ({ ...EMPTY_SNAPSHOT, ...s });

describe("page and API access by role", () => {
  it("opens public pages to everyone and sends signed-out visitors to sign in", () => {
    expect(access("/", undefined).ok).toBe(true);
    expect(access("/login", undefined).ok).toBe(true);
    expect(access("/responsible", undefined).ok).toBe(true);
    expect(access("/talent/explore", undefined)).toEqual({ ok: false, reason: "signed-out" });
    expect(access("/api/talent/cv", undefined, "POST")).toEqual({ ok: false, reason: "signed-out" });
    expect(access("/api/version", undefined).ok).toBe(true);
  });

  it("gives each role only its own pages", () => {
    expect(access("/talent/explore", "talent").ok).toBe(true);
    expect(access("/meetings/talent", "talent").ok).toBe(true);
    expect(access("/meetings/company", "talent")).toMatchObject({ ok: false, reason: "forbidden" });
    expect(access("/organiser/insights", "company")).toMatchObject({ need: ["organiser"] });
    expect(access("/company/agenda", "organiser").ok).toBe(false);
  });

  it("guards API routes by role, and only Espoo may reset", () => {
    expect(access("/api/talent/cv", "company", "POST").ok).toBe(false);
    expect(access("/api/intake", "talent", "POST").ok).toBe(false);
    expect(access("/api/organiser/assistant", "company", "POST").ok).toBe(false);
    expect(access("/api/match/rank", "talent", "POST").ok).toBe(false);
    expect(access("/api/match/rank", "company", "POST").ok).toBe(true);
    expect(access("/api/demo-state", "talent", "PATCH").ok).toBe(true);
    expect(access("/api/demo-state", "company", "DELETE").ok).toBe(false);
    expect(access("/api/demo-state", "organiser", "DELETE").ok).toBe(true);
    expect(can("organiser", "organiser:reset")).toBe(true);
    expect(can("talent", "organiser:reset")).toBe(false);
  });
});

describe("signed session cookie", () => {
  it("round-trips and rejects tampering and expiry", async () => {
    const token = await signSession({ role: "talent", id: "T-30", name: "X" });
    expect(await verifySession(token)).toMatchObject({ role: "talent", id: "T-30" });
    const [payload, sig] = token.split(".");
    const forged = btoa(JSON.stringify({ role: "organiser", id: "ESPOO", name: "X", exp: Date.now() + 1e6 }))
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
    expect(await verifySession(`${payload}.${sig}x`)).toBeNull();
    expect(await verifySession(token, Date.now() + 13 * 3600_000)).toBeNull();
    expect(await verifySession(undefined)).toBeNull();
  });
});

describe("who may write which part of a pair", () => {
  const organiser = { role: "organiser" as const, id: "ESPOO" };
  const talent = { role: "talent" as const, id: "T-30" };
  const stranger = { role: "talent" as const, id: "T-12" };
  const owner = { role: "company" as const, id: company };
  const rival = { role: "company" as const, id: otherCompany };

  it("lets a candidate apply only for themselves", () => {
    const p = patch({ pairs: { [key]: { optIn: { talent: true } } } });
    expect(authorizePatch(p, EMPTY_SNAPSHOT, talent, SEED_NEEDS)).toBeNull();
    expect(authorizePatch(p, EMPTY_SNAPSHOT, stranger, SEED_NEEDS)).toMatch(/Not your pair/);
    expect(authorizePatch(p, EMPTY_SNAPSHOT, owner, SEED_NEEDS)).toMatch(/optIn.talent/);
  });

  it("keeps decisions, Espoo results and the log with the organiser", () => {
    const decision = { status: "approved" as const, reason: "fit", at: "2026-11-14T10:00:00.000Z" };
    const p = patch({ pairs: { [key]: { decision } } });
    expect(authorizePatch(p, EMPTY_SNAPSHOT, organiser, SEED_NEEDS)).toBeNull();
    expect(authorizePatch(p, EMPTY_SNAPSHOT, talent, SEED_NEEDS)).toMatch(/decision/);
    expect(authorizePatch(p, EMPTY_SNAPSHOT, owner, SEED_NEEDS)).toMatch(/decision/);
    const screen = patch({ pairs: { [key]: { screening: { result: "passed", reason: "ok" } } } });
    expect(authorizePatch(screen, EMPTY_SNAPSHOT, talent, SEED_NEEDS)).toMatch(/screening.result/);
    const audit = patch({
      audit: [
        {
          id: "a",
          at: "2026-11-14T10:00:00.000Z",
          actor: "x",
          action: "approved",
          needId: "N-01",
          talentId: "T-30",
          from: "none",
          to: "approved",
          reason: "r",
        },
      ],
    });
    expect(authorizePatch(audit, EMPTY_SNAPSHOT, owner, SEED_NEEDS)).toMatch(/decision log/);
  });

  it("lets only the owning company invite or offer, and the candidate answer the offer", () => {
    const current = snap({ pairs: { [key]: { optIn: { talent: true } } } });
    const invite = patch({ pairs: { [key]: { optIn: { talent: true, company: true } } } });
    expect(authorizePatch(invite, current, owner, SEED_NEEDS)).toBeNull();
    expect(authorizePatch(invite, current, rival, SEED_NEEDS)).toMatch(/Not your pair/);
    const offered = snap({ pairs: { [key]: { offer: { status: "offered", at: "t" } } } });
    const accept = patch({ pairs: { [key]: { offer: { status: "offered", at: "t", answer: true } } } });
    expect(authorizePatch(accept, offered, talent, SEED_NEEDS)).toBeNull();
    expect(authorizePatch(accept, offered, owner, SEED_NEEDS)).toMatch(/offer.answer/);
  });

  it("lets either side clear later steps on its own pair (decline, withdraw)", () => {
    const current = snap({ pairs: { [key]: { optIn: { company: true, talent: true }, slot: "10:20" } } });
    const decline = patch({ pairs: { [key]: { optIn: { company: true, talent: false } } } });
    expect(authorizePatch(decline, current, talent, SEED_NEEDS)).toBeNull();
    expect(authorizePatch(patch({ pairs: { [key]: null } }), current, stranger, SEED_NEEDS)).toMatch(
      /Not your pair/,
    );
  });

  it("lets each account save only its own card", () => {
    const own: Need = { ...need, id: `N-${company}-NEW`, createdByUser: true };
    expect(authorizePatch(patch({ needs: [own] }), EMPTY_SNAPSHOT, owner, SEED_NEEDS)).toBeNull();
    expect(authorizePatch(patch({ needs: [own] }), EMPTY_SNAPSHOT, rival, SEED_NEEDS)).toMatch(/own need/);
    // Can't take over another company's need by relabelling it.
    const hijack: Need = { ...need, companyId: otherCompany, createdByUser: true };
    expect(authorizePatch(patch({ needs: [hijack] }), EMPTY_SNAPSHOT, rival, SEED_NEEDS)).toMatch(
      /another company/,
    );
    const card = { id: "T-30", createdByUser: true } as never;
    expect(authorizePatch(patch({ talent: [card] }), EMPTY_SNAPSHOT, talent, SEED_NEEDS)).toBeNull();
    expect(authorizePatch(patch({ talent: [card] }), EMPTY_SNAPSHOT, stranger, SEED_NEEDS)).toMatch(
      /own card/,
    );
  });
});

describe("saved candidate profile", async () => {
  const { cleanDraft } = await import("@/lib/candidate-profile");
  it("keeps known fields with the right types and drops the rest", () => {
    const d = cleanDraft({
      step: 9,
      title: "Teacher",
      skills: ["S-1", 4, "S-2"],
      answers: { a: "text", b: 3 },
      mode: "Moon",
      contact: { fullName: "A B", email: "a@example.com", evil: "x" },
      isAdmin: true,
    })!;
    expect(d.step).toBe(0);
    expect(d.title).toBe("Teacher");
    expect(d.skills).toEqual(["S-1", "S-2"]);
    expect(d.answers).toEqual({ a: "text" });
    expect(d.mode).toBe("Any");
    expect(d.contact).toEqual({ fullName: "A B", email: "a@example.com", phone: "", city: "" });
    expect("isAdmin" in d).toBe(false);
    expect(cleanDraft("nope")).toBeNull();
    expect(cleanDraft({ path: "x".repeat(200_000) })).toBeNull();
  });
});

describe("no database keys in the UI", async () => {
  const { anonAlias, SEED_TALENT } = await import("@/lib/seed");
  const { participants } = await import("@/lib/participants");
  it("anonymised names don't contain the id and stay unique", () => {
    const ids = [...SEED_TALENT.map((t) => t.id), "T-YOU"];
    const aliases = ids.map(anonAlias);
    expect(new Set(aliases).size).toBe(ids.length);
    ids.forEach((id, i) => expect(aliases[i]).not.toContain(id));
    expect(anonAlias("T-30")).toBe(anonAlias("T-30"));
  });
  it("account names don't show ids", () => {
    for (const p of participants()) expect(p.name).not.toContain(p.id);
  });
});
