"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InboxIcon,
  ListChecksIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT } from "@/lib/data";
import { skillLabel } from "@/lib/esco";
import { fairnessSummary, funnel, needSupply, overview, poolProfile, type Supply } from "@/lib/oversight";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * Plain-language overview for HR and organisers: what needs attention, how far matches
 * have got, whether the pool can fill each need, who is in the pool, and a fairness check.
 * Every number is a simple count; nothing here ranks or scores individuals.
 */

const SUPPLY: Record<Supply, { label: string; icon: typeof CircleCheckIcon; className: string }> = {
  good: { label: "Good supply", icon: CircleCheckIcon, className: "text-evidence" },
  few: { label: "Only a few", icon: CircleAlertIcon, className: "text-transfer" },
  none: { label: "No one yet", icon: UserPlusIcon, className: "text-muted-foreground" },
};

/** One horizontal bar: label, value written out, bar scaled to `max`. Single series, one hue. */
function Bar({
  label,
  value,
  max,
  sub,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  sub?: string;
}) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div
      className="group space-y-1"
      title={`${typeof label === "string" ? label : ""}: ${value}${sub ? ` (${sub})` : ""}`}
    >
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 tabular-nums">
          <span className="font-medium">{value}</span>
          {sub && <span className="text-xs text-muted-foreground"> · {sub}</span>}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-muted">
        <div
          className="h-2.5 rounded-full bg-primary transition-[width] group-hover:opacity-80"
          style={{ width: `${value ? Math.max(pct, 2) : 0}%` }}
        />
      </div>
    </div>
  );
}

export function OrganiserOverview({ onReview }: { onReview: (needId?: string) => void }) {
  const { needs, talent, decisions, optIns, slots, feedback } = useDemo();
  const o = overview(needs, talent, decisions, optIns, slots);
  const stages = funnel(needs, talent, decisions, optIns, slots, feedback);
  const supply = needSupply(needs, talent, decisions);
  const profile = poolProfile(talent);
  const fairness = fairnessSummary(needs, talent);
  const waiting = supply.filter((s) => s.toReview > 0);
  const empty = supply.filter((s) => s.supply === "none");

  const tiles = [
    { label: "Need cards submitted", value: o.needs, icon: InboxIcon, hint: "roles companies want to fill" },
    { label: "People in the pool", value: o.pool, icon: UsersIcon, hint: "anonymised skill cards" },
    {
      label: "Waiting for you",
      value: o.awaitingReview,
      icon: ListChecksIcon,
      hint: "suggested matches to review",
    },
    { label: "Approved matches", value: o.approved, icon: CheckIcon, hint: "you said yes" },
    { label: "Meetings booked", value: o.meetings, icon: CalendarCheckIcon, hint: `on ${EVENT.date}` },
  ];

  return (
    <div className="space-y-6">
      {/* What to do next */}
      <Card className="border-primary/20 bg-accent/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-lg font-medium">
              {o.awaitingReview
                ? `${o.awaitingReview} suggested ${o.awaitingReview === 1 ? "match is" : "matches are"} waiting for you`
                : "You're up to date"}
            </p>
            <p className="text-sm text-muted-foreground">
              {o.awaitingReview
                ? `Across ${waiting.length} company ${waiting.length === 1 ? "need" : "needs"}. Each takes about a minute: read why it was suggested, then approve or reject with a reason.`
                : "Every suggested match has a decision. New need cards and skill cards will show up here."}
              {empty.length > 0 &&
                ` ${empty.length} ${empty.length === 1 ? "need has" : "needs have"} no one in the pool yet.`}
            </p>
          </div>
          {o.awaitingReview > 0 && (
            <Button size="lg" onClick={() => onReview(waiting[0]?.need.id)}>
              Start reviewing <ArrowRightIcon data-icon="inline-end" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <Card key={t.label} size="sm">
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="text-xs">{t.label}</span>
                <t.icon className="size-4 shrink-0" />
              </div>
              <p className="text-3xl font-semibold tabular-nums">{t.value}</p>
              <p className="truncate text-xs text-muted-foreground">{t.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">From suggestion to meeting</CardTitle>
            <CardDescription>
              How many matches reached each step. Nothing moves forward without a person saying yes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stages.map((s) => (
              <Bar key={s.stage} label={s.stage} value={s.value} max={stages[0].value} />
            ))}
          </CardContent>
        </Card>

        {/* Supply per need */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Can the pool fill each need?</CardTitle>
            <CardDescription>
              People whose skills overlap at least 40% with the need. “Only a few” or “No one yet” means
              it&apos;s worth inviting more talent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {supply.map((s) => {
              const st = SUPPLY[s.supply];
              return (
                <div key={s.need.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Bar
                      label={
                        <span>
                          {s.need.title} <span className="text-muted-foreground">· {s.need.company}</span>
                        </span>
                      }
                      value={s.relevant}
                      max={Math.max(...supply.map((x) => x.relevant), 1)}
                      sub={st.label}
                    />
                  </div>
                  <st.icon className={cn("size-4 shrink-0", st.className)} aria-label={st.label} />
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => onReview(s.need.id)}
                    disabled={!s.relevant && !s.toReview}
                  >
                    {s.toReview ? `Review ${s.toReview}` : "Open"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Pool profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who is in the pool</CardTitle>
            <CardDescription>
              People with at least one skill in each area. {Math.round(profile.evidencedShare * 100)}% back at
              least one skill with their own answers, not just a CV line.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {profile.areas.map((a) => (
                <Bar
                  key={a.area}
                  label={a.area}
                  value={a.people}
                  max={talent.length}
                  sub={`of ${talent.length}`}
                />
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Most common skills</p>
              <div className="flex flex-wrap gap-1.5">
                {profile.topSkills.map((s) => (
                  <span key={s.skill} className="rounded-full border px-2.5 py-0.5 text-xs">
                    {skillLabel(s.skill)}{" "}
                    <span className="text-muted-foreground tabular-nums">{s.people}</span>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fairness */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fairness check</CardTitle>
            <CardDescription>
              Do people from different groups get suggested at similar rates? Groups are used only for this
              check, never for matching.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {fairness.map((f) => (
              <div key={f.dimension} className="flex items-start gap-3 rounded-lg border p-3">
                {f.ok ? (
                  <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-evidence" aria-hidden />
                ) : (
                  <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-transfer" aria-hidden />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p>
                    <span className="font-medium">{f.dimension}:</span> {f.ok ? "Balanced" : "Worth a look"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {f.ok
                      ? "Every group is suggested at a similar rate."
                      : `${f.lowest.group} is suggested less often (${Math.round(f.lowest.rate * 100)}%) than ${f.highest.group} (${Math.round(f.highest.rate * 100)}%). Check rejections and invite more matching needs.`}
                  </p>
                </div>
              </div>
            ))}
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/responsible" />}>
              Full fairness and privacy report <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
