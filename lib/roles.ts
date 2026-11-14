/**
 * The demo has three separate views, one per role. The organiser (the City of Espoo event
 * team) is the broker: it reviews skill matches across every company and introduces people,
 * always with a reason. The company and the candidate then each say yes or no; a meeting is
 * booked only when both do. Each role only sees its own pages; the header shows the role
 * tabs and the current role's page nav from this list.
 */
export const ROLES = [
  {
    id: "talent",
    label: "Job seeker",
    title: "People looking for work",
    pages: [
      { href: "/talent", label: "Skill card" },
      { href: "/talent/explore", label: "Explore roles" },
      { href: "/meetings/talent", label: "Applications" },
      { href: "/talent/agenda", label: "My agenda" },
    ],
  },
  {
    id: "organiser",
    label: "Espoo Esbo",
    title: "City of Espoo event team",
    pages: [
      { href: "/organiser", label: "Introductions" },
      { href: "/organiser/insights", label: "Insights" },
    ],
  },
  {
    id: "company",
    label: "Company",
    title: "Hiring companies",
    pages: [
      { href: "/company", label: "Find candidates" },
      { href: "/meetings/company", label: "Candidates from Espoo" },
      { href: "/company/agenda", label: "My agenda" },
    ],
  },
] as const;

export type Role = (typeof ROLES)[number];
export type RoleId = Role["id"];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * The role a path belongs to. /responsible belongs to no role: it's open to everyone.
 */
export function roleOf(pathname: string): Role | undefined {
  return ROLES.find((r) => r.pages.some((p) => under(pathname, p.href)));
}

/** The page within a role that matches the path best (longest href wins). */
export function activePage(role: Role, pathname: string) {
  return [...role.pages]
    .filter((p) => under(pathname, p.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
