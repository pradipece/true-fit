import type { RoleId } from "../roles";

/**
 * Role-based access control for the demo's mock sign-in (lib/auth/session.ts). Pure and
 * shared: proxy.ts guards pages and API routes with it, app/api/demo-state checks every
 * write with it (lib/auth/patch-rbac.ts), and the UI hides what a role may not do.
 *
 * Three roles, one per view: a job seeker (talent), the City of Espoo event team
 * (organiser) and a hiring company. Each signs in as one account and only ever sees and
 * changes its own pages and its own side of a pair.
 */

export type Permission =
  // Job seeker
  | "talent:profile" // build and save their own skill card
  | "talent:apply" // apply to / ask to meet a role
  | "talent:respond" // answer Espoo's invitation, the company and an offer; book interviews
  // Organiser (Espoo)
  | "organiser:review" // see every need and candidate, decide introductions
  | "organiser:screen" // record the Espoo interview result
  | "organiser:insights"
  | "organiser:reset" // reset the shared demo data
  // Company
  | "company:need" // write its own need card (intake chat)
  | "company:request" // ask Espoo to introduce a candidate
  | "company:respond" // invite to interview, book, give feedback, make an offer
  // Shared
  | "ai:match"; // AI fit rate and "why this match"

export const ROLE_PERMISSIONS: Record<RoleId, readonly Permission[]> = {
  talent: ["talent:profile", "talent:apply", "talent:respond"],
  organiser: ["organiser:review", "organiser:screen", "organiser:insights", "organiser:reset", "ai:match"],
  company: ["company:need", "company:request", "company:respond", "ai:match"],
};

export const can = (role: RoleId | undefined, perm: Permission) =>
  !!role && ROLE_PERMISSIONS[role].includes(perm);

export const ROLE_IDS: readonly RoleId[] = ["talent", "organiser", "company"];
export const isRole = (v: unknown): v is RoleId => ROLE_IDS.includes(v as RoleId);

/** Where a role lands after signing in. */
export const HOME: Record<RoleId, string> = {
  talent: "/talent/explore",
  organiser: "/organiser",
  company: "/company",
};

const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Pages open to everyone, signed in or not. */
const PUBLIC_PAGES = ["/", "/login", "/responsible"];

/** Page prefix → the only role that may open it. */
const PAGE_RULES: [prefix: string, role: RoleId][] = [
  ["/meetings/talent", "talent"],
  ["/meetings/company", "company"],
  ["/talent", "talent"],
  ["/company", "company"],
  ["/organiser", "organiser"],
];

/**
 * API prefix (+ optional method) → roles allowed, or "public", or "signed-in" (any role).
 * First match wins, so more specific entries come first. Anything unlisted needs sign-in.
 */
type ApiRule = { prefix: string; method?: string; allow: "public" | "signed-in" | RoleId[] };
const API_RULES: ApiRule[] = [
  { prefix: "/api/version", allow: "public" },
  { prefix: "/api/schedule", allow: "public" },
  { prefix: "/api/db/health", allow: "public" },
  { prefix: "/api/demo-state", method: "DELETE", allow: ["organiser"] },
  // GET and PATCH: signed in; each write is then checked field by field.
  { prefix: "/api/demo-state", allow: "signed-in" },
  { prefix: "/api/esco", allow: "signed-in" },
  { prefix: "/api/intake", allow: ["company"] },
  { prefix: "/api/talent", allow: ["talent"] },
  { prefix: "/api/organiser", allow: ["organiser"] },
  { prefix: "/api/match", allow: ["company", "organiser"] },
];

export type Access =
  { ok: true } | { ok: false; reason: "signed-out" } | { ok: false; reason: "forbidden"; need: RoleId[] };

/** May `role` (undefined = signed out) open this page or call this API route? */
export function access(pathname: string, role: RoleId | undefined, method = "GET"): Access {
  if (pathname.startsWith("/api/")) {
    const rule = API_RULES.find((r) => under(pathname, r.prefix) && (!r.method || r.method === method));
    const allow = rule?.allow ?? "signed-in";
    if (allow === "public") return { ok: true };
    if (!role) return { ok: false, reason: "signed-out" };
    if (allow === "signed-in" || allow.includes(role)) return { ok: true };
    return { ok: false, reason: "forbidden", need: allow };
  }
  if (PUBLIC_PAGES.some((p) => pathname === p)) return { ok: true };
  const rule = PAGE_RULES.find(([prefix]) => under(pathname, prefix));
  if (!rule) return { ok: true };
  if (!role) return { ok: false, reason: "signed-out" };
  return rule[1] === role ? { ok: true } : { ok: false, reason: "forbidden", need: [rule[1]] };
}

/** The role a protected page belongs to, if any. */
export const pageRole = (pathname: string) => PAGE_RULES.find(([prefix]) => under(pathname, prefix))?.[1];
