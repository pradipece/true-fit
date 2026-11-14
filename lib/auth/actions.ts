"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSeed } from "../seed-db";
import { findAccount } from "./accounts";
import { access, HOME, isRole } from "./rbac";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "./session";

/** Only same-site paths, and only ones the new role may open; else the role's home. */
function safeNext(next: unknown, role: Parameters<typeof access>[1]) {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return HOME[role!];
  const path = next.split(/[?#]/)[0];
  if (path === "/login" || !access(path, role).ok) return HOME[role!];
  return next;
}

async function setSession(role: string, id: string) {
  if (!isRole(role)) throw new Error("Unknown role");
  await getSeed(); // fills the registry the account list reads
  const account = findAccount(role, id);
  if (!account) throw new Error("Unknown demo account");
  (await cookies()).set(SESSION_COOKIE, await signSession({ role, id, name: account.name }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return role;
}

/** Sign in as a demo account (login form). */
export async function signIn(formData: FormData) {
  const role = await setSession(String(formData.get("role")), String(formData.get("account")));
  redirect(safeNext(formData.get("next"), role));
}

/** Demo shortcut: sign in as someone else and open a page, e.g. the candidate a pair belongs to. */
export async function switchAccount(role: string, id: string, next?: string) {
  const r = await setSession(role, id);
  redirect(safeNext(next, r));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
