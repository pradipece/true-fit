import { cookies } from "next/headers";
import { connection } from "next/server";
import type { RoleId } from "../roles";
import { can, type Permission } from "./rbac";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

/**
 * Server-side session access (Server Components, route handlers, server actions). proxy.ts
 * already turns away the wrong role, but every route checks again here: the proxy is an
 * optimistic gate, not the authority.
 */
export async function getSession(): Promise<Session | null> {
  // Request time only: the expiry check reads the clock, which can't be prerendered.
  await connection();
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

type Guard = { session: Session; error?: never } | { session?: never; error: Response };

/** For route handlers: the session if it has `perm` (or one of `roles`), else a 401/403 response. */
export async function requireAccess(rule: { perm?: Permission; roles?: RoleId[] } = {}): Promise<Guard> {
  const session = await getSession();
  if (!session) return { error: Response.json({ error: "Sign in first" }, { status: 401 }) };
  const ok =
    (!rule.perm || can(session.role, rule.perm)) && (!rule.roles || rule.roles.includes(session.role));
  return ok ? { session } : { error: Response.json({ error: "Not allowed for your role" }, { status: 403 }) };
}
