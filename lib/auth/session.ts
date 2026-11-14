import type { RoleId } from "../roles";
import { isRole } from "./rbac";

/**
 * Mock sign-in for the demo: the session is a small JSON payload signed with HMAC-SHA256
 * (Web Crypto, so it runs in proxy.ts, route handlers and server actions alike) and kept
 * in an httpOnly cookie. There are no passwords: every account is synthetic. In
 * production this would be a real identity provider (e.g. Suomi.fi e-Identification for
 * job seekers, company SSO, City of Espoo staff accounts).
 */

export type Session = {
  role: RoleId;
  /** Participant id: a company (C-…), a candidate (T-…), or "ESPOO" for the organiser. */
  id: string;
  name: string;
  /** Expiry, ms since epoch. */
  exp: number;
};

export const SESSION_COOKIE = "tf_session";
export const SESSION_HOURS = 12;

// Demo fallback so the prototype runs without setup; set AUTH_SECRET in any shared deployment.
const secret = () => process.env.AUTH_SECRET || "true-fit-demo-only-secret-change-me";

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const fromB64url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** Constant-time comparison of two byte arrays. */
function equal(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function signSession(s: Omit<Session, "exp">, now = Date.now()): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ ...s, exp: now + SESSION_HOURS * 3600_000 })));
  return `${payload}.${b64url(await hmac(payload))}`;
}

/** The session in a cookie value, or null if missing, tampered with or expired. */
export async function verifySession(token: string | undefined, now = Date.now()): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!equal(fromB64url(sig), await hmac(payload))) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (!isRole(s.role) || typeof s.id !== "string" || typeof s.name !== "string") return null;
    if (typeof s.exp !== "number" || s.exp < now) return null;
    return { role: s.role, id: s.id, name: s.name, exp: s.exp };
  } catch {
    return null;
  }
}
