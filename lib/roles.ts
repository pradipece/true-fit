/**
 * The demo has two separate views, one per role: companies and job seekers. Each side
 * decides for itself (companies invite, candidates accept); there is no organiser role. Each role only sees its own pages;
 * the header shows the role tabs and the current role's page nav from this list.
 */
export const ROLES = [
  {
    id: "talent",
    label: "Job seeker",
    title: "People looking for work",
    pages: [
      { href: "/talent", label: "Skill card" },
      { href: "/talent/explore", label: "Explore roles" },
      { href: "/meetings/talent", label: "Meetings" },
      { href: "/talent/agenda", label: "My agenda" },
    ],
  },
  {
    id: "company",
    label: "Company",
    title: "Hiring companies",
    pages: [
      { href: "/company", label: "Find candidates" },
      { href: "/company/candidates", label: "Candidates" },
      { href: "/meetings/company", label: "Meetings" },
      { href: "/company/agenda", label: "My agenda" },
      { href: "/company/insights", label: "Insights" },
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
