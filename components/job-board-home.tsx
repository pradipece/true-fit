"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  Building2Icon,
  CalendarDaysIcon,
  LandmarkIcon,
  MapPinIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserRoundPlusIcon,
  UserSearchIcon,
} from "lucide-react";
import { CompanyLogo, JobMeta, postedLabel } from "@/components/job-listing";
import { useSession } from "@/components/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EVENT } from "@/lib/data";
import { skillLabel } from "@/lib/esco";
import { companyOf } from "@/lib/schedule";
import { useDemo } from "@/lib/store";

const MODES = ["Any", "On-site", "Hybrid", "Remote"] as const;

const STEPS = [
  {
    icon: UserRoundPlusIcon,
    title: "Create your profile",
    text: "Turn your past job into skills and show them in four short answers. No CV needed.",
  },
  {
    icon: BadgeCheckIcon,
    title: "Apply to jobs",
    text: "See your skill match for every job and apply in one click.",
  },
  {
    icon: LandmarkIcon,
    title: "Espoo interview",
    text: "The City of Espoo team meets you first and introduces you to the company.",
  },
  {
    icon: Building2Icon,
    title: "Interview and offer",
    text: "Meet the company on a weekday that suits you, online or on site, and get your answer here.",
  },
];

/** The public landing page, laid out as a job portal: search, latest jobs, how applying works. */
export function JobBoardHome() {
  const { needs } = useDemo();
  const { session } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]>("Any");

  const companies = useMemo(() => {
    const m = new Map<string, { name: string; jobs: number }>();
    for (const n of needs) {
      const id = companyOf(n);
      m.set(id, { name: n.company, jobs: (m.get(id)?.jobs ?? 0) + 1 });
    }
    return [...m.values()].sort((a, b) => b.jobs - a.jobs);
  }, [needs]);
  const latest = useMemo(
    () =>
      [...needs].sort(
        (a, b) =>
          Number(!!b.createdByUser) - Number(!!a.createdByUser) ||
          a.submittedWeeksBefore - b.submittedWeeksBefore,
      ),
    [needs],
  );

  const isTalent = session?.role === "talent";
  const search = (params: Record<string, string>) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    router.push(`/talent/explore${sp.size ? `?${sp}` : ""}`);
  };

  return (
    <div>
      {/* Hero + search */}
      <section className="border-b bg-gradient-to-b from-accent/60 to-background">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-12 sm:px-6 sm:py-16">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <CalendarDaysIcon className="size-4" /> Interviews {EVENT.time} · {EVENT.place}
          </p>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Find your next job in Espoo
            </h1>
            <p className="text-lg text-pretty text-muted-foreground">
              {needs.length} open jobs at {companies.length} companies. Apply with your skills, not a polished
              CV: every job shows how well you match, and a real person at the City of Espoo introduces you.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search({ q: q.trim(), mode: mode === "Any" ? "" : mode });
            }}
            className="flex max-w-3xl flex-col gap-2 rounded-2xl border bg-card p-2 shadow-sm sm:flex-row"
          >
            <label className="relative flex-1">
              <span className="sr-only">Job title, skill or company</span>
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Job title, skill or company"
                className="h-11 border-0 pl-9 text-base shadow-none focus-visible:ring-0"
              />
            </label>
            <label className="relative flex items-center sm:w-44 sm:border-l">
              <span className="sr-only">Way of working</span>
              <MapPinIcon className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as (typeof MODES)[number])}
                className="h-11 w-full appearance-none bg-transparent pr-3 pl-9 text-sm outline-none"
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m === "Any" ? "Any way of working" : m}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" size="lg" className="h-11 px-6">
              Search jobs
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Popular:</span>
            {[...new Set(needs.map((n) => n.title))].slice(0, 5).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => search({ q: t })}
                className="rounded-full border bg-background px-3 py-1 hover:bg-muted"
              >
                {t}
              </button>
            ))}
          </div>
          {!session && (
            <p className="text-sm text-muted-foreground">
              Searching and applying needs a free (demo) job seeker account:{" "}
              <Link
                href="/login?role=talent"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                sign in
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_320px]">
        {/* Latest jobs */}
        <section className="space-y-4" aria-labelledby="latest-jobs">
          <div className="flex items-end justify-between gap-3">
            <h2 id="latest-jobs" className="text-xl font-semibold tracking-tight">
              Latest jobs
            </h2>
            <Link
              href="/talent/explore"
              className="flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              See all {needs.length} jobs <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <ul className="space-y-3">
            {latest.slice(0, 8).map((n) => (
              <li key={n.id}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <CompanyLogo name={n.company} className="size-12" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/talent/explore?job=${encodeURIComponent(n.id)}`}
                          className="text-base font-semibold hover:text-primary hover:underline"
                        >
                          {n.title}
                        </Link>
                        {n.createdByUser && <Badge>New</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{n.company}</span> · {n.companyBlurb}
                      </p>
                      <JobMeta need={n} />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {n.must.slice(0, 4).map((s) => (
                          <span
                            key={s}
                            className="rounded-md bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                          >
                            {skillLabel(s)}
                          </span>
                        ))}
                        {n.must.length > 4 && (
                          <span className="px-1 text-xs text-muted-foreground">
                            +{n.must.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                      <span className="text-xs text-muted-foreground">{postedLabel(n)}</span>
                      <Button
                        size="sm"
                        nativeButton={false}
                        render={<Link href={`/talent/explore?job=${encodeURIComponent(n.id)}`} />}
                      >
                        {isTalent ? "View and apply" : "Apply"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-semibold">Hiring companies</h2>
              <ul className="space-y-2">
                {companies.map((c) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      onClick={() => search({ q: c.name })}
                      className="flex w-full items-center gap-3 rounded-lg p-1 text-left hover:bg-muted"
                    >
                      <CompanyLogo name={c.name} className="size-8 text-xs" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {c.jobs} job{c.jobs === 1 ? "" : "s"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="bg-primary text-primary-foreground ring-0">
            <CardContent className="space-y-3">
              <UserSearchIcon className="size-6" />
              <h2 className="font-semibold">Looking for candidates?</h2>
              <p className="text-sm opacity-90">
                Describe the role in a short chat and see people whose skills fit. Espoo interviews them
                before introducing them to you.
              </p>
              <Button
                variant="secondary"
                size="sm"
                nativeButton={false}
                render={<Link href={session?.role === "company" ? "/company" : "/login?role=company"} />}
              >
                Find candidates <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <LandmarkIcon className="size-4 text-primary" /> City of Espoo event team
              </p>
              <p className="text-muted-foreground">
                Review applications, run Espoo interviews and make introductions.
              </p>
              <Link
                href={session?.role === "organiser" ? "/organiser" : "/login?role=organiser"}
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                Staff sign-in <ArrowRightIcon className="size-3.5" />
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* How applying works */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">How applying works</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="space-y-2 rounded-xl border bg-card p-4">
                <span className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {i + 1}
                  </span>
                  <s.icon className="size-4 text-primary" />
                </span>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheckIcon className="size-3.5" /> Matching uses skills only, never origin, language
              background or education.
            </span>
            <span className="flex items-center gap-1">
              <SparklesIcon className="size-3.5" /> The AI only suggests; people make every decision.
            </span>
            <Link href="/responsible" className="underline underline-offset-4 hover:text-foreground">
              Responsible AI
            </Link>
            <span>All people and companies are made up.</span>
          </p>
        </div>
      </section>
    </div>
  );
}
