"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BriefcaseIcon,
  Building2Icon,
  CalendarCheckIcon,
  CheckIcon,
  CompassIcon,
  HandIcon,
  KeyRoundIcon,
  MailOpenIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  TrendingUpIcon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyRanking } from "@/components/company-ranking";
import { CompanyLogo, JobMeta, jobMatchesQuery, postedLabel } from "@/components/job-listing";
import { Input } from "@/components/ui/input";
import { IdentitySwitch, useIdentity } from "@/components/identity";
import { ScoreMeter } from "@/components/match-explanation";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { skillLabel } from "@/lib/esco";
import {
  companiesFor,
  interestStatus,
  proofBoost,
  rolesFor,
  unlockSkills,
  type InterestStatus,
} from "@/lib/explore";
import { pairKey, SUGGEST_THRESHOLD } from "@/lib/match";
import { modeKind } from "@/lib/need-terms";
import { stageOf, TALENT_LABEL, type Stage } from "@/lib/pipeline";
import { useDemo } from "@/lib/store";
import type { MatchExplanation, Need } from "@/lib/types";
import { cn } from "@/lib/utils";

const pct = (x: number) => `${Math.round(x * 100)}%`;

const STATUS: Record<Exclude<InterestStatus, "none">, string> = {
  asked: "border-primary/30 bg-accent text-accent-foreground",
  action: "border-evidence/30 bg-evidence-soft text-evidence",
  progress: "border-primary/30 bg-accent text-accent-foreground",
  hired: "bg-evidence text-white",
  passed: "border-border bg-secondary text-secondary-foreground",
  declined: "border-dashed",
};

/** Short status for the company ranking's role rows. */
const SHORT: Record<Exclude<InterestStatus, "none">, string> = {
  asked: "Asked",
  action: "Your move",
  progress: "In progress",
  hired: "Hired",
  passed: "Not this time",
  declined: "You said no",
};

/**
 * Find jobs: every role at the event as a job board (search, filters, list + detail) with
 * an "Apply" button, ranked by the same skills-only match the companies see. Applying sets
 * the candidate's yes; the organiser decides whom to invite to an Espoo interview and the
 * company still answers yes or no. Below the board: advice for the person's own profile
 * (show proof, learn one skill) and the companies that suit them best.
 */
export function ExploreRoles() {
  const { needs, talent, decisions, optIns, slots, screening, offers, setOptIn } = useDemo();
  const { id } = useIdentity("talent");
  const profile = talent.find((t) => t.id === id);
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [mode, setMode] = useState<ModeFilter>(
    MODE_FILTERS.includes(params.get("mode") as ModeFilter) ? (params.get("mode") as ModeFilter) : "Any",
  );
  const [filter, setFilter] = useState<"all" | "strong" | "asked">("all");
  const [sort, setSort] = useState<"match" | "newest">("match");

  const roles = useMemo(
    () =>
      profile
        ? rolesFor(needs, profile)
        : needs.map((need) => ({ need, m: null as MatchExplanation | null })),
    [needs, profile],
  );
  const companies = useMemo(() => (profile ? companiesFor(needs, profile) : []), [needs, profile]);
  const unlocks = useMemo(() => (profile ? unlockSkills(needs, profile) : []), [needs, profile]);
  const boosts = useMemo(
    () =>
      profile
        ? roles
            .map((r) => ({ ...r, boost: r.m ? proofBoost(r.need, profile, r.m) : null }))
            .filter((r) => r.boost)
            .sort((a, b) => b.boost!.after - b.boost!.before - (a.boost!.after - a.boost!.before))
        : [],
    [roles, profile],
  );

  const pipeline = { decisions, optIns, slots, screening, offers };
  const stageFor = (n: Need) => (profile ? stageOf(pairKey(n.id, profile.id), pipeline) : null);
  const statusOf = (n: Need): InterestStatus => {
    const st = stageFor(n);
    return st ? interestStatus(st) : "none";
  };

  const strong = roles.filter((r) => r.m?.suggested).length;
  const asked = roles.filter((r) => statusOf(r.need) !== "none").length;
  const shown = roles
    .filter((r) => jobMatchesQuery(r.need, q, skillLabel))
    .filter((r) => mode === "Any" || modeKind(r.need.mode) === mode)
    .filter((r) =>
      filter === "strong" ? r.m?.suggested : filter === "asked" ? statusOf(r.need) !== "none" : true,
    )
    .sort((a, b) =>
      sort === "newest"
        ? Number(!!b.need.createdByUser) - Number(!!a.need.createdByUser) ||
          a.need.submittedWeeksBefore - b.need.submittedWeeksBefore
        : (b.m?.score ?? 0) - (a.m?.score ?? 0),
    );
  const selectedId = params.get("job");
  const current = shown.find((r) => r.need.id === selectedId) ?? shown[0];
  const select = (nid: string) => {
    const sp = new URLSearchParams(params);
    sp.set("job", nid);
    router.replace(`/talent/explore?${sp}`, { scroll: false });
  };
  const topBoost = boosts[0];
  const needTitle = (nid: string) => needs.find((n) => n.id === nid)?.title ?? nid;

  const apply = (n: Need) => {
    if (!profile) return;
    setOptIn(pairKey(n.id, profile.id), "talent", true);
    toast.success(`Application sent to ${n.company}`, {
      description:
        "Espoo reviews it next to your profile. If your skills fit, it invites you to a short interview; if you pass, it sends your profile to the company.",
    });
  };
  const withdraw = (n: Need) => {
    if (!profile) return;
    setOptIn(pairKey(n.id, profile.id), "talent", undefined);
    toast("Application withdrawn", { description: "Espoo no longer sees it." });
  };

  return (
    <div className="space-y-6">
      {profile ? (
        <IdentitySwitch side="talent" />
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
          <CompassIcon className="size-5 shrink-0" />
          <p className="min-w-0 flex-1">
            <span className="font-medium">Create your profile to apply.</span> Once you have one, every job
            shows your skill match and you can apply in one click.
          </p>
          <Button size="sm" nativeButton={false} render={<Link href="/talent" />}>
            Create my profile <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search jobs</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Job title, skill or company"
              className="h-10 pl-9"
            />
          </label>
          <select
            aria-label="Way of working"
            value={mode}
            onChange={(e) => setMode(e.target.value as ModeFilter)}
            className="h-10 rounded-lg border bg-background px-3 text-sm"
          >
            {MODE_FILTERS.map((m) => (
              <option key={m} value={m}>
                {m === "Any" ? "Any way of working" : m}
              </option>
            ))}
          </select>
          {profile && (
            <select
              aria-label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as "match" | "newest")}
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="match">Best skill match</option>
              <option value="newest">Newest</option>
            </select>
          )}
        </div>
        {profile && (
          <div className="flex flex-wrap items-center gap-1 text-sm" role="group" aria-label="Filter jobs">
            {(
              [
                ["all", `All jobs (${roles.length})`],
                ["strong", `Strong fits (${strong})`],
                ["asked", `Applied (${asked})`],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={filter === v}
                onClick={() => setFilter(v)}
                className={cn(
                  "rounded-full border px-3 py-1 text-muted-foreground transition-colors hover:text-foreground",
                  filter === v && "border-primary bg-accent text-accent-foreground",
                )}
              >
                {label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              Strong fit = at least {pct(SUGGEST_THRESHOLD)} skill match
            </span>
          </div>
        )}
      </div>

      {/* Job list + detail */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="space-y-2">
          <p className="px-1 text-xs text-muted-foreground">
            {shown.length} job{shown.length === 1 ? "" : "s"}
            {profile && sort === "match" ? ", best skill match first" : ""}
          </p>
          {shown.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No jobs match your search. Try fewer words or another way of working.
              </CardContent>
            </Card>
          )}
          <ul className="space-y-2 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-1">
            {shown.map(({ need, m }) => {
              const st = statusOf(need);
              const active = current?.need.id === need.id;
              return (
                <li key={need.id}>
                  <button
                    type="button"
                    onClick={() => select(need.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50",
                      active && "border-primary ring-1 ring-primary",
                      st === "passed" && "opacity-70",
                    )}
                  >
                    <CompanyLogo name={need.company} />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="block truncate font-medium">{need.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">{need.company}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {need.mode} · {need.language}
                      </span>
                      {st !== "none" && (
                        <Badge variant="outline" className={cn("mt-1 font-normal", STATUS[st])}>
                          {SHORT[st]}
                        </Badge>
                      )}
                    </span>
                    {m && (
                      <span
                        className={cn(
                          "h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                          m.suggested
                            ? "bg-evidence-soft text-evidence"
                            : "bg-secondary text-secondary-foreground",
                        )}
                        title="Skill match"
                      >
                        {pct(m.score)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {current && (
          <JobDetail
            need={current.need}
            m={current.m}
            status={statusOf(current.need)}
            stage={stageFor(current.need)?.stage ?? "none"}
            boost={boosts.find((b) => b.need.id === current.need.id)?.boost ?? null}
            pair={profile ? pairKey(current.need.id, profile.id) : ""}
            hasProfile={!!profile}
            onApply={() => apply(current.need)}
            onWithdraw={() => withdraw(current.need)}
          />
        )}
      </div>

      {profile && (
        <>
          <h2 className="pt-4 text-lg font-semibold tracking-tight">Improve your chances</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={BriefcaseIcon} value={roles.length} label="open jobs at this event" />
            <Stat
              icon={BadgeCheckIcon}
              value={strong}
              label={`strong fits (at least ${pct(SUGGEST_THRESHOLD)} skill match)`}
              accent
            />
            <Stat icon={HandIcon} value={asked} label="jobs you applied to or were invited to" />
          </div>

          {/* Next best moves */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-evidence/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUpIcon className="size-4 text-evidence" /> Show it, don&apos;t just say it
                </CardTitle>
                <CardDescription>
                  Skills you show in an answer count twice as much as skills you only state. AI can write a
                  CV; it can&apos;t fake your own example.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topBoost ? (
                  <>
                    <p className="text-sm">
                      Add one example of{" "}
                      <span className="font-medium">
                        {topBoost.boost!.skills.map((s) => skillLabel(s).toLowerCase()).join(" and ")}
                      </span>{" "}
                      and your match for <span className="font-medium">{topBoost.need.title}</span> at{" "}
                      {topBoost.need.company} goes from
                    </p>
                    <BoostBar before={topBoost.boost!.before} after={topBoost.boost!.after} />
                    {boosts.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Showing proof would raise your match for {boosts.length} jobs in total.
                      </p>
                    )}
                    <Button size="sm" nativeButton={false} render={<Link href="/talent" />}>
                      Add an example to my profile <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Every skill your best jobs rely on is already shown in your answers. Nice work.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-transfer/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <KeyRoundIcon className="size-4 text-transfer" /> Skills that open the most doors here
                </CardTitle>
                <CardDescription>
                  What companies at this event ask for that you don&apos;t have yet, ranked by how many jobs
                  it would open. Advice for you only; it never ranks you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {unlocks.length ? (
                  <ol className="space-y-3">
                    {unlocks.map((u, i) => (
                      <li key={u.skill} className="flex items-start gap-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-transfer-soft text-xs font-semibold text-transfer tabular-nums">
                          {i + 1}
                        </span>
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-sm font-medium">{skillLabel(u.skill)}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.opened.length
                              ? `Opens ${u.opened.length} more strong ${u.opened.length === 1 ? "fit" : "fits"}: ${u.opened.map(needTitle).join(", ")}`
                              : `Raises your match across jobs by ${Math.round(u.gain * 100)} points in total`}
                            {u.buildsOn && u.buildsOn.relation >= 0.3 && (
                              <> · builds on your {skillLabel(u.buildsOn.skill).toLowerCase()}</>
                            )}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You already cover what the jobs here ask for.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Company ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2Icon className="size-4 text-primary" /> Companies that match your profile
              </CardTitle>
              <CardDescription>
                Every company at this event, ranked by its best job for your skills, then by how many of its
                jobs are strong fits. Same skill match as above; nothing else counts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyRanking
                companies={companies}
                renderRole={(need) => {
                  const st = statusOf(need);
                  return st === "none" ? (
                    <Button size="xs" variant="outline" onClick={() => apply(need)}>
                      <SendIcon data-icon="inline-start" /> Apply
                    </Button>
                  ) : (
                    <Badge variant="outline" className={cn("font-normal", STATUS[st])}>
                      {SHORT[st]}
                    </Badge>
                  );
                }}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

type ModeFilter = "Any" | "On-site" | "Hybrid" | "Remote";
const MODE_FILTERS: ModeFilter[] = ["Any", "On-site", "Hybrid", "Remote"];

function Stat({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: typeof BriefcaseIcon;
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <Icon className={cn("size-5 shrink-0 text-muted-foreground", accent && "text-evidence")} />
      <div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function BoostBar({ before, after }: { before: number; after: number }) {
  return (
    <div className="space-y-1.5" aria-label={`Skill match from ${pct(before)} to ${pct(after)}`}>
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 bg-evidence/35" style={{ width: pct(after) }} />
        <div className="absolute inset-y-0 left-0 bg-evidence" style={{ width: pct(before) }} />
        <div
          className="absolute inset-y-0 w-px bg-foreground/50"
          style={{ left: pct(SUGGEST_THRESHOLD) }}
          title="Suggestion line"
        />
      </div>
      <p className="flex items-center gap-2 text-sm tabular-nums">
        <span className="text-muted-foreground">{pct(before)}</span>
        <ArrowRightIcon className="size-3.5 text-evidence" />
        <span className="font-semibold text-evidence">{pct(after)}</span>
        <span className="text-xs text-muted-foreground">skill match</span>
        {before < SUGGEST_THRESHOLD && after >= SUGGEST_THRESHOLD && (
          <Badge variant="outline" className="border-evidence/30 bg-evidence-soft font-normal text-evidence">
            <SparklesIcon data-icon="inline-start" /> crosses the suggestion line
          </Badge>
        )}
      </p>
    </div>
  );
}

const APPLY_STEPS = ["Apply", "Espoo interview", "Company interview", "Offer"];

/** The selected job, laid out like a job ad, with the Apply button and the application's status. */
function JobDetail({
  need,
  m,
  status,
  stage,
  boost,
  pair,
  hasProfile,
  onApply,
  onWithdraw,
}: {
  need: Need;
  m: MatchExplanation | null;
  status: InterestStatus;
  stage: Stage;
  boost: ReturnType<typeof proofBoost>;
  pair: string;
  hasProfile: boolean;
  onApply: () => void;
  onWithdraw: () => void;
}) {
  const action = !hasProfile ? (
    <Button size="lg" nativeButton={false} render={<Link href="/talent" />}>
      Create a profile to apply <ArrowRightIcon data-icon="inline-end" />
    </Button>
  ) : status === "none" ? (
    <Button size="lg" onClick={onApply}>
      <SendIcon data-icon="inline-start" /> Apply now
    </Button>
  ) : status === "asked" ? (
    <Button size="lg" variant="outline" onClick={onWithdraw}>
      <Undo2Icon data-icon="inline-start" /> Withdraw application
    </Button>
  ) : (
    <Button
      size="lg"
      variant={status === "action" ? "default" : "outline"}
      nativeButton={false}
      render={<Link href={`/meetings/talent?pair=${encodeURIComponent(pair)}`} />}
    >
      {status === "action" ? "Answer now" : "Track application"} <ArrowRightIcon data-icon="inline-end" />
    </Button>
  );

  return (
    <Card className="h-fit lg:sticky lg:top-28">
      <CardHeader className="gap-3">
        <div className="flex items-start gap-4">
          <CompanyLogo name={need.company} className="size-14 text-lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
              {need.title}
              {m?.suggested && (
                <Badge
                  variant="outline"
                  className="border-evidence/30 bg-evidence-soft font-normal text-evidence"
                >
                  strong fit
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              <span className="font-medium text-foreground">{need.company}</span> · {need.companyBlurb}
            </CardDescription>
            <JobMeta need={need} />
            <p className="text-xs text-muted-foreground">{postedLabel(need)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {action}
          {status !== "none" && (
            <Badge
              variant="outline"
              className={cn("font-normal", STATUS[status as Exclude<InterestStatus, "none">])}
            >
              {status === "hired" ? (
                <CalendarCheckIcon data-icon="inline-start" />
              ) : status === "action" ? (
                <MailOpenIcon data-icon="inline-start" />
              ) : status === "asked" || status === "progress" ? (
                <CheckIcon data-icon="inline-start" />
              ) : null}
              {TALENT_LABEL[stage]}
            </Badge>
          )}
          {m && <ScoreMeter score={m.score} role={need.title} className="ml-auto" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 border-t pt-4">
        {need.summary && (
          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold">About the job</h3>
            <p className="text-sm text-pretty text-muted-foreground">{need.summary}</p>
          </section>
        )}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">
            {m ? "Skills, compared with your profile" : "Skills they ask for"}
          </h3>
          {m ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {m.shared.map((s) => (
                  <SkillChip key={s.skill} id={s.skill} kind={s.level} must={s.must} />
                ))}
                {m.transferable.map((t) => (
                  <SkillChip key={t.to} id={t.to} kind="transfer" from={t.from} must={t.must} />
                ))}
                {m.gaps.map((g) => (
                  <SkillChip key={g.skill} id={g.skill} kind="gap" must={g.must} />
                ))}
              </div>
              <SkillLegend />
            </>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">Must have</p>
              <div className="flex flex-wrap gap-1.5">
                {need.must.map((s) => (
                  <span key={s} className="rounded-md bg-secondary px-2 py-0.5 text-xs">
                    {skillLabel(s)}
                  </span>
                ))}
              </div>
              {need.nice.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">Nice to have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {need.nice.map((s) => (
                      <span key={s} className="rounded-md border px-2 py-0.5 text-xs">
                        {skillLabel(s)}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {boost && (
            <p className="flex items-center gap-1.5 text-xs text-evidence">
              <TrendingUpIcon className="size-3.5" />
              Show {boost.skills.map((s) => skillLabel(s).toLowerCase()).join(" and ")} in an answer:{" "}
              {pct(boost.before)} → {pct(boost.after)}
            </p>
          )}
        </section>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">How applying works</h3>
          <ol className="flex flex-wrap items-center gap-1.5 text-xs">
            {APPLY_STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-1.5">
                <span className="rounded-full border px-2 py-0.5">
                  {i + 1}. {step}
                </span>
                {i < APPLY_STEPS.length - 1 && <ArrowRightIcon className="size-3 text-muted-foreground" />}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Your profile stays anonymous until you pass the Espoo interview. Language, way of working and
            start date are shown for you to judge; only skills count toward the match.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
