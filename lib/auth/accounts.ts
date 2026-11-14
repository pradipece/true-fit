import { participants } from "../participants";
import type { RoleId } from "../roles";

/**
 * The demo accounts anyone can sign in as: the Espoo event team, every company and every
 * candidate in the synthetic seed, plus a new company and a new job seeker who build their
 * cards during the demo. Reads the seed registry, so call it after getSeed() (server) or
 * inside DemoProvider (browser).
 */
export type Account = { role: RoleId; id: string; name: string; sub: string };

export const ORGANISER_ACCOUNT: Account = {
  role: "organiser",
  id: "ESPOO",
  name: "Espoo Esbo event team",
  sub: "City of Espoo recruitment events",
};

export function accounts(): Account[] {
  const people = participants().map((p) => ({
    role: p.kind as RoleId,
    id: p.id,
    name: p.name,
    sub: p.sub,
  }));
  // No shared "new" accounts (T-YOU, C-YOU): job seekers and companies sign up with their
  // own account (lib/auth/job-seekers.ts), so nobody overwrites anyone else's information.
  // Everyone listed here is a view-only demo account (plus the Espoo team).
  return [ORGANISER_ACCOUNT, ...people.filter((a) => !a.id.endsWith("-YOU"))];
}

export const findAccount = (role: RoleId, id: string) =>
  accounts().find((a) => a.role === role && a.id === id);
