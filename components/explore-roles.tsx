"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BriefcaseIcon,
  CalendarCheckIcon,
  CheckIcon,
  CompassIcon,
  HandIcon,
  KeyRoundIcon,
  LanguagesIcon,
  MailOpenIcon,
  SparklesIcon,
  TrendingUpIcon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { IdentitySwitch, useIdentity } from "@/components/identity";
import { ScoreMeter } from "@/components/match-explanation";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { skillLabel } from "@/lib/esco";
import { interestStatus, proofBoost, rolesFor, unlockSkills, type InterestStatus } from "@/lib/explore";
import { pairKey, SUGGEST_THRESHOLD } from "@/lib/match";
import { useDemo } from "@/lib/store";
import type { MatchExplanation, Need } from "@/lib/types";
import { cn } from "@/lib/utils";

const pct = (x: number) => `${Math.round(x * 100)}%`;

const STATUS: Record<Exclude<InterestStatus, "none">, { label: string; className: string }> = {
  asked: {
    label: "You asked to meet · the company decides",
    className: "border-primary/30 bg-accent text-accent-foreground",
  },
  invited: {
    label: "The company invited you",
    className: "border-evidence/30 bg-evidence-soft text-evidence",
  },
  both: {
    label: "You both said yes · pick a time",
    className: "border-evidence/30 bg-evidence-soft text-evidence",
  },
  booked: { label: "Meeting booked", className: "bg-evidence text-white" },
  passed: {
    label: "Not this time for this role",
    className: "border-border bg-secondary text-secondary-foreground",
  },
  declined: { label: "You said no", className: "border-dashed" },
};

/**
 * Job seekers explore every role at the event, ranked by the same skills-only match the
 * companies see. They get two kinds of advice for their own card (show proof, learn one
 * skill) and can ask to meet. Asking never changes the match; the company still decides.
 */
export function ExploreRoles() {
  const { needs, talent, decisions, optIns, slots, setOptIn } = useDemo();
  const { id, me } = useIdentity("talent");
  const profile = talent.find((t) => t.id === id);
  const [filter, setFilter] = useState<"all" | "strong" | "asked">("all");

  const roles = useMemo(() => (profile ? rolesFor(needs, profile) : []), [needs, profile]);
  const unlocks = useMemo(() => (profile ? unlockSkills(needs, profile) : []), [needs, profile]);
  const boosts = useMemo(
    () =>
      profile
        ? roles
            .map((r) => ({ ...r, boost: proofBoost(r.need, profile, r.m) }))
            .filter((r) => r.boost)
            .sort((a, b) => b.boost!.after - b.boost!.before - (a.boost!.after - a.boost!.before))
        : [],
    [roles, profile],
  );

  if (!profile) {
    return (
      <div className="space-y-4">
        <IdentitySwitch side="talent" />
        <Card>
          <CardContent className="space-y-3 py-10 text-center">
            <CompassIcon className="mx-auto size-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              Make your skill card first. Then you can see every role at this event, ranked by how well your
              skills fit.
            </p>
            <Button nativeButton={false} render={<Link href="/talent" />}>
              Make my skill card <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusOf = (n: Need) => {
    const key = pairKey(n.id, profile.id);
    return interestStatus(optIns[key], decisions[key], slots[key]);
  };
  const strong = roles.filter((r) => r.m.suggested).length;
  const asked = roles.filter((r) => statusOf(r.need) !== "none").length;
  const shown = roles.filter((r) =>
    filter === "strong" ? r.m.suggested : filter === "asked" ? statusOf(r.need) !== "none" : true,
  );
  const topBoost = boosts[0];
  const needTitle = (nid: string) => needs.find((n) => n.id === nid)?.title ?? nid;

  const ask = (n: Need) => {
    setOptIn(pairKey(n.id, profile.id), "talent", true);
    toast.success(`You asked to meet ${n.company}`, {
      description:
        "They see your request next to your skill card. If they invite you, you pick a time in Meetings.",
    });
  };
  const withdraw = (n: Need) => {
    setOptIn(pairKey(n.id, profile.id), "talent", undefined);
    toast("Request withdrawn", { description: `${n.company} no longer sees it.` });
  };

  return (
    <div className="space-y-6">
      <IdentitySwitch side="talent" />

      {/* Headline numbers */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={BriefcaseIcon} value={roles.length} label="roles at this event" />
        <Stat
          icon={BadgeCheckIcon}
          value={strong}
          label={`strong fits (at least ${pct(SUGGEST_THRESHOLD)} skill match)`}
          accent
        />
        <Stat icon={HandIcon} value={asked} label="roles where you asked or were invited" />
      </div>

      {/* Next best moves */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-evidence/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUpIcon className="size-4 text-evidence" /> Show it, don&apos;t just say it
            </CardTitle>
            <CardDescription>
              Skills you show in an answer count twice as much as skills you only state. AI can write a CV; it
              can&apos;t fake your own example.
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
                    Showing proof would raise your match for {boosts.length} roles in total.
                  </p>
                )}
                <Button size="sm" nativeButton={false} render={<Link href="/talent" />}>
                  Add an example to my card <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Every skill your best roles rely on is already shown in your answers. Nice work.
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
              What companies at this event ask for that you don&apos;t have yet, ranked by how many roles it
              would open. Advice for you only; it never ranks you.
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
                          : `Raises your match across roles by ${Math.round(u.gain * 100)} points in total`}
                        {u.buildsOn && u.buildsOn.relation >= 0.3 && (
                          <> · builds on your {skillLabel(u.buildsOn.skill).toLowerCase()}</>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">You already cover what the roles here ask for.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Role list */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">
              Roles for {me?.name ?? profile.alias}, best skill match first
            </h2>
            <p className="text-xs text-muted-foreground">
              The same skill match companies see. Language, way of working and start date are shown for you to
              judge; they are not part of the percentage.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border p-0.5 text-sm" role="group" aria-label="Filter roles">
            {(
              [
                ["all", `All (${roles.length})`],
                ["strong", `Strong fits (${strong})`],
                ["asked", `In progress (${asked})`],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                aria-pressed={filter === v}
                onClick={() => setFilter(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground",
                  filter === v && "bg-secondary text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <SkillLegend />

        {shown.length === 0 && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Nothing here yet. Ask to meet a company from the full list.
            </CardContent>
          </Card>
        )}
        {shown.map(({ need, m }) => (
          <RoleCard
            key={need.id}
            need={need}
            m={m}
            status={statusOf(need)}
            boost={boosts.find((b) => b.need.id === need.id)?.boost ?? null}
            pair={pairKey(need.id, profile.id)}
            onAsk={() => ask(need)}
            onWithdraw={() => withdraw(need)}
          />
        ))}
      </div>
    </div>
  );
}

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

function RoleCard({
  need,
  m,
  status,
  boost,
  pair,
  onAsk,
  onWithdraw,
}: {
  need: Need;
  m: MatchExplanation;
  status: InterestStatus;
  boost: ReturnType<typeof proofBoost>;
  pair: string;
  onAsk: () => void;
  onWithdraw: () => void;
}) {
  return (
    <Card className={cn(status === "passed" && "opacity-75")}>
      <CardHeader>
        <CardDescription>
          {need.company} · {need.companyBlurb}
        </CardDescription>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {need.title}
          {m.suggested && (
            <Badge
              variant="outline"
              className="border-evidence/30 bg-evidence-soft font-normal text-evidence"
            >
              strong fit
            </Badge>
          )}
        </CardTitle>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <ScoreMeter score={m.score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {need.summary && <p className="text-sm text-muted-foreground">{need.summary}</p>}
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
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <LanguagesIcon className="size-3.5" /> {need.language}
          </span>
          <span>{need.mode}</span>
          {need.timing && (
            <span>
              Starts {need.timing.start} · {need.timing.engagement}
            </span>
          )}
        </p>
        {boost && (
          <p className="flex items-center gap-1.5 text-xs text-evidence">
            <TrendingUpIcon className="size-3.5" />
            Show {boost.skills.map((s) => skillLabel(s).toLowerCase()).join(" and ")} in an answer:{" "}
            {pct(boost.before)} → {pct(boost.after)}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex-wrap items-center gap-2">
        {status !== "none" && (
          <Badge variant="outline" className={cn("font-normal", STATUS[status].className)}>
            {status === "booked" ? (
              <CalendarCheckIcon data-icon="inline-start" />
            ) : status === "invited" ? (
              <MailOpenIcon data-icon="inline-start" />
            ) : status === "asked" || status === "both" ? (
              <CheckIcon data-icon="inline-start" />
            ) : null}
            {STATUS[status].label}
          </Badge>
        )}
        <span className="ml-auto flex gap-1">
          {status === "none" && (
            <Button size="sm" onClick={onAsk}>
              <HandIcon data-icon="inline-start" /> Ask to meet
            </Button>
          )}
          {status === "asked" && (
            <Button size="sm" variant="outline" onClick={onWithdraw}>
              <Undo2Icon data-icon="inline-start" /> Withdraw
            </Button>
          )}
          {(status === "invited" || status === "both" || status === "booked") && (
            <Button
              size="sm"
              variant={status === "booked" ? "outline" : "default"}
              nativeButton={false}
              render={<Link href={`/meetings/talent?pair=${encodeURIComponent(pair)}`} />}
            >
              {status === "invited" ? "Answer" : status === "both" ? "Pick a time" : "See meeting"}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          )}
        </span>
      </CardFooter>
    </Card>
  );
}
