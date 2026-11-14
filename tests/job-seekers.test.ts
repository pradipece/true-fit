import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SEED_TALENT } from "@/lib/seed";

/** Many people signing up at once: each gets their own account; seed candidates stay untouched. */

const pg = new PGlite();
vi.mock("@/lib/db", () => ({ db: () => ({ query: (t: string, p?: unknown[]) => pg.query(t, p) }) }));
vi.mock("@/lib/seed-db", () => ({ getSeed: async () => ({ talent: SEED_TALENT }) }));

const { cleanSignUp, isSeedTalent, signUpCompanyOrIn, signUpOrIn } = await import("@/lib/auth/job-seekers");

beforeAll(async () => {
  await pg.exec(`CREATE TABLE job_seeker_accounts (
    id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now())`);
  await pg.exec(`CREATE TABLE company_accounts (
    id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now())`);
});

describe("job seeker sign-up", () => {
  it("validates and normalises the input", () => {
    expect(cleanSignUp(" Aino  Virtanen ", " Aino@Example.com ")).toEqual({
      name: "Aino Virtanen",
      email: "aino@example.com",
    });
    expect(cleanSignUp("A", "not-an-email")).toHaveProperty("error");
  });

  it("gives everyone their own id, and the same email signs back in", async () => {
    const people = await Promise.all(
      Array.from({ length: 25 }, (_, i) => signUpOrIn(`Person ${i}`, `p${i}@example.com`)),
    );
    const ids = people.map((p) => ("id" in p ? p.id : ""));
    expect(new Set(ids).size).toBe(25);
    expect(ids.every((id) => /^T-[a-z0-9]{10}$/.test(id))).toBe(true);
    const again = await signUpOrIn("Someone else", "p3@example.com");
    expect(again).toMatchObject({ id: ids[3], name: "Person 3" });
  });

  it("needs a name for a new email, and never collides with demo candidates", async () => {
    expect(await signUpOrIn("", "new@example.com")).toHaveProperty("error");
    const p = await signUpOrIn("New", "new@example.com");
    expect("id" in p && SEED_TALENT.some((t) => t.id === p.id)).toBe(false);
    expect(await isSeedTalent(SEED_TALENT[0].id)).toBe(true);
    expect(await isSeedTalent("id" in p ? p.id : "")).toBe(false);
  });
});

describe("company sign-up", () => {
  it("gives each company its own account, separate from job seekers", async () => {
    const a = await signUpCompanyOrIn("Nuuksio Software Oy", "hr@nuuksio.example.com");
    const b = await signUpCompanyOrIn("Other Oy", "jobs@other.example.com");
    expect(a).toMatchObject({ name: "Nuuksio Software Oy" });
    expect("id" in a && /^C-[a-z0-9]{10}$/.test(a.id)).toBe(true);
    expect("id" in a && "id" in b && a.id !== b.id).toBe(true);
    expect(await signUpCompanyOrIn("Renamed", "hr@nuuksio.example.com")).toMatchObject({
      id: "id" in a ? a.id : "",
      name: "Nuuksio Software Oy",
    });
    expect(await signUpCompanyOrIn("", "x@example.com")).toHaveProperty("error");
  });
});
