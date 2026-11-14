import Link from "next/link";
import { ArrowRightIcon, CalendarDaysIcon } from "lucide-react";
import { ROLE_ICON } from "@/components/role-icons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT } from "@/lib/data";
import { ROLES, type RoleId } from "@/lib/roles";

const POINTS: Record<RoleId, string[]> = {
  company: [
    "Describe who you'd like to meet in a short guided chat",
    "Check and approve a short card listing the skills you need",
    "Say yes to suggested candidates and book a 10-minute slot",
  ],
  talent: [
    "Translate your job title or career path into skills",
    "Show evidence with short answers instead of a CV",
    "Say yes to suggested companies; your name stays hidden until it's mutual",
  ],
  organiser: [
    "Review suggested matches and approve each one, with a reason",
    "Follow opt-ins and the event-day schedule per table",
    "Check fairness, the audit log and EU AI Act notes",
  ],
};

/** Role picker. Each role has its own view; in production each would sign in separately. */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
      <div className="max-w-2xl space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <CalendarDaysIcon className="size-4" /> {EVENT.name} · {EVENT.date}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          More signal, less noise at Espoo recruitment events
        </h1>
        <p className="text-pretty text-muted-foreground">
          Companies describe real needs, talent shows real evidence, and organisers approve explainable
          matches. Pick a view. For the demo you can switch between them at any time.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {ROLES.map((r) => {
          const Icon = ROLE_ICON[r.id];
          return (
            <Link key={r.id} href={r.pages[0].href} className="group">
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <div className="mb-2 grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="flex items-center justify-between">
                    {r.label} view
                    <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                  <CardDescription>{r.title}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
                    {POINTS[r.id].map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
      <div className="rounded-xl border bg-muted/40 p-4 text-sm">
        <p className="font-medium">New here?</p>
        <p className="text-muted-foreground">
          Try the views in order: describe a need as a{" "}
          <strong className="font-medium text-foreground">company</strong>, build a skill card as a{" "}
          <strong className="font-medium text-foreground">job seeker</strong>, then approve matches as the{" "}
          <strong className="font-medium text-foreground">organiser</strong>. Each page has a short “How this
          page works” guide at the top.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        All people and companies are made up. The AI only suggests; people make every decision.
      </p>
    </div>
  );
}
