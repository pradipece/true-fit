import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, Building2Icon, CalendarDaysIcon, UserRoundIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Meetings" };

const VIEWS = [
  {
    href: "/meetings/company",
    icon: Building2Icon,
    title: "Company view",
    description: "Hiring teams at the event",
    points: [
      "See anonymised candidates the organiser approved, and why",
      "Say yes or no to each one",
      "Book a 10-minute slot at your table, then give feedback",
    ],
  },
  {
    href: "/meetings/talent",
    icon: UserRoundIcon,
    title: "Candidate view",
    description: "Job seekers with a skill card",
    points: [
      "See which companies were suggested to you, and why",
      "Say yes or no; your name stays hidden until it's mutual",
      "Book a slot, meet, then give feedback",
    ],
  },
];

export default function MeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        step={4}
        eyebrow="Both sides · before, during and after"
        title="Opt in, meet for 10 minutes, follow up"
        description="Each side has its own view and sees only its own answers. For the demo you can open both; in production each side signs in on its own device."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {VIEWS.map((v) => (
          <Link key={v.href} href={v.href} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/50">
              <CardHeader>
                <div className="mb-2 grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <v.icon className="size-5" />
                </div>
                <CardTitle className="flex items-center justify-between">
                  {v.title}
                  <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardTitle>
                <CardDescription>{v.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
                  {v.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <p className="text-sm">
        <Link
          href="/meetings/agenda"
          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
        >
          <CalendarDaysIcon className="size-4" /> Open the agenda for any participant →
        </Link>
      </p>
    </div>
  );
}
