import { randomBytes } from "node:crypto";
import { db } from "../db";
import { getSeed } from "../seed-db";

/**
 * Accounts created in the app: job seekers (table job_seeker_accounts) and companies
 * (company_accounts). Server-only.
 * Mock sign-in: an email identifies the account and there is no password, as in the rest
 * of the demo; production would use a real identity provider (e.g. Suomi.fi). Each account
 * has its own id, so people never share a profile or a company's roles. The seed (demo)
 * candidates and companies are view-only and can't be created or changed here.
 */

export const MAX_ACCOUNTS = 2000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export type JobSeeker = { id: string; name: string; email: string };

export function cleanSignUp(nameRaw: unknown, emailRaw: unknown) {
  const name = String(nameRaw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  const email = String(emailRaw ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." } as const;
  return { name, email } as const;
}

const newId = (prefix: "T" | "C") =>
  `${prefix}-${[...randomBytes(10)].map((b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("")}`;

const TABLE = { talent: "job_seeker_accounts", company: "company_accounts" } as const;

/**
 * The account for this email: an existing one signs back in (its name is kept), a new
 * email creates one, which needs a name. Never a seed account: those are view-only.
 */
async function signUpOrInAs(
  kind: keyof typeof TABLE,
  name: string,
  email: string,
): Promise<JobSeeker | { error: string }> {
  const pool = db();
  const table = TABLE[kind];
  const found = await pool.query(`SELECT id, name, email FROM ${table} WHERE email = $1`, [email]);
  if (found.rows[0]) return found.rows[0] as JobSeeker;
  if (!name)
    return {
      error: `New here? Add ${kind === "company" ? "your company's name" : "your name"} to create your account.`,
    };
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
  if (rows[0].n >= MAX_ACCOUNTS) return { error: "Sign-ups are full for this demo. Please try again later." };
  const created = await pool.query(
    `INSERT INTO ${table} (id, name, email) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, name, email`,
    [newId(kind === "company" ? "C" : "T"), name, email],
  );
  return created.rows[0] as JobSeeker;
}

export const signUpOrIn = (name: string, email: string) => signUpOrInAs("talent", name, email);
export const signUpCompanyOrIn = (name: string, email: string) => signUpOrInAs("company", name, email);

/** Is this one of the synthetic demo candidates (whose profile nobody may change)? */
export async function isSeedTalent(id: string) {
  const { talent } = await getSeed();
  return talent.some((t) => t.id === id);
}
