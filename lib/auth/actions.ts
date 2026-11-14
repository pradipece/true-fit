"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { RoleId } from "../roles";
import { getSeed } from "../seed-db";
import { findAccount } from "./accounts";
import { cleanSignUp, signUpCompanyOrIn, signUpOrIn } from "./job-seekers";
import { access, HOME, isRole } from "./rbac";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "./session";

/** Only same-site paths, and only ones the new role may open; else the role's home. */
function safeNext(next: unknown, role: RoleId) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return HOME[role];
  const path = next.split(/[?#]/)[0];
  if (path === "/login" || !access(path, role).ok) return HOME[role];
  return next;
}

async function writeSession(role: RoleId, id: string, name: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession({ role, id, name }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

/** A listed demo account (Espoo, a company, a demo candidate); null if it isn't one. */
async function demoAccount(role: string, id: string) {
  if (!isRole(role)) return null;
  await getSeed(); // fills the registry the account list reads
  return findAccount(role, id) ?? null;
}

/** Sign in as a listed demo account (login form). */
export async function signIn(formData: FormData) {
  const account = await demoAccount(String(formData.get("role")), String(formData.get("account")));
  if (!account) redirect("/login");
  await writeSession(account.role, account.id, account.name);
  redirect(safeNext(formData.get("next"), account.role));
}

// Best-effort brake on sign-up floods from one address (per server instance).
const recent = new Map<string, number[]>();
const SIGNUPS_PER_10_MIN = 10;
function throttled(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 600_000);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > SIGNUPS_PER_10_MIN;
}

export type SignUpState = { error?: string };

/** Create or reopen a self-service account (job seeker or company) and sign in. */
async function signUp(role: "talent" | "company", formData: FormData): Promise<SignUpState> {
  const input = cleanSignUp(formData.get("name"), formData.get("email"));
  if ("error" in input) return { error: input.error };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  if (throttled(ip)) return { error: "Too many sign-ups from here. Please wait a few minutes." };
  let account;
  try {
    account =
      role === "company"
        ? await signUpCompanyOrIn(input.name, input.email)
        : await signUpOrIn(input.name, input.email);
  } catch {
    return { error: "Couldn't reach the database. Please try again." };
  }
  if ("error" in account) return { error: account.error };
  await writeSession(role, account.id, account.name);
  redirect(safeNext(formData.get("next"), role));
}

/**
 * Job seekers: create your own account (name + email), or come back with the same email.
 * Every person gets their own id and profile, so nobody overwrites anyone else's.
 */
export async function signUpJobSeeker(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  return signUp("talent", formData);
}

/**
 * Companies: create your own company account (company name + email) to post roles. The
 * demo companies are view-only, so nobody can change their information.
 */
export async function signUpCompany(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  return signUp("company", formData);
}

/**
 * Demo shortcut: sign in as a listed demo account and open a page, e.g. the candidate a
 * pair belongs to. Accounts people created themselves can't be switched into; that
 * leads to the login page instead.
 */
export async function switchAccount(role: string, id: string, next?: string) {
  const account = await demoAccount(role, id);
  if (!account) redirect(`/login?role=${isRole(role) ? role : "talent"}`);
  await writeSession(account.role, account.id, account.name);
  redirect(safeNext(next, account.role));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
