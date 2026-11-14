/**
 * The demo has three separate views, one per role. Each role only sees its own pages;
 * the header shows the role tabs and the current role's page nav from this list.
 */
export const ROLES = [
  {
    id: "company",
    label: "Company",
    title: "Hiring companies",
    pages: [
      { href: "/company", label: "Need card" },
      { href: "/meetings/company", label: "Meetings" },
      { href: "/meetings/agenda/C-YOU", label: "My agenda" },
    ],
  },
  {
    id: "talent",
    label: "Job seeker",
    title: "People looking for work",
    pages: [
      { href: "/talent", label: "Skill card" },
      { href: "/meetings/talent", label: "Meetings" },
      { href: "/meetings/agenda/T-YOU", label: "My agenda" },
    ],
  },
  {
    id: "organiser",
    label: "Organiser",
    title: "City of Espoo event staff",
    pages: [
      { href: "/organiser/dashboard", label: "Dashboard" },
      { href: "/organiser", label: "Matches" },
      { href: "/meetings/organiser", label: "Event day" },
      { href: "/meetings/agenda", label: "Agendas" },
      { href: "/responsible", label: "Responsible AI" },
    ],
  },
] as const;

export type Role = (typeof ROLES)[number];
export type RoleId = Role["id"];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** The role a path belongs to. A participant's agenda belongs to that participant's side. */
export function roleOf(pathname: string): Role | undefined {
  const agenda = pathname.match(/^\/meetings\/agenda\/([^/]+)/);
  if (agenda) return ROLES.find((r) => r.id === (agenda[1].startsWith("T-") ? "talent" : "company"));
  return ROLES.find((r) => r.pages.some((p) => under(pathname, p.href)));
}

/** The page within a role that matches the path best (longest href wins). */
export function activePage(role: Role, pathname: string) {
  return [...role.pages]
    .filter((p) => under(pathname, p.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
