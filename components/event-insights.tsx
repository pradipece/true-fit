"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  HandshakeIcon,
  InboxIcon,
  ListChecksIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CHART, ChartCard, Columns, HBars, StackedHBars, type Series } from "@/components/charts";
import { EVENT } from "@/lib/data";
import { dashboardData } from "@/lib/dashboard";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

const DECISIONS: Series[] = [
  { key: "approved", label: "Invited", color: CHART.blue },
  { key: "waiting", label: "Not decided yet", color: CHART.amber },
  { key: "rejected", label: "Not now", color: CHART.magenta },
];

const SKILLS: Series[] = [
  { key: "shown", label: "Shown in answers", color: CHART.green },
  { key: "stated", label: "Stated only", color: CHART.blue },
];

const fmtRating = (v: number | null) => (v === null ? "–" : `${v.toFixed(1)} / 5`);

/** Event insights for companies: headline numbers and charts. Counts and averages only, never individuals. */
export function EventInsights() {
  const { needs, talent, decisions, optIns, slots, feedback } = useDemo();
  const d = useMemo(
    () => dashboardData({ needs, talent, decisions, optIns, slots, feedback }),
    [needs, talent, decisions, optIns, slots, feedback],
  );

  const tiles = [
    { label: "People registered", icon: UsersIcon, ...d.tiles.registered },
    { label: "Company needs", icon: InboxIcon, ...d.tiles.needs },
    { label: "Suggested matches", icon: SparklesIcon, ...d.tiles.suggested },
    { label: "To review", icon: ListChecksIcon, ...d.tiles.waiting, highlight: d.tiles.waiting.value > 0 },
    { label: "Meetings booked", icon: CalendarCheckIcon, ...d.tiles.booked },
    { label: "Follow-ups agreed", icon: HandshakeIcon, ...d.tiles.followUps },
  ];

  const funnelMax = Math.max(1, ...d.funnel.map((s) => s.value));
  const slotMax = Math.max(d.slotLoad.tables, ...d.slotLoad.slots.map((s) => s.booked));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Card
            key={t.label}
            size="sm"
            className={cn("highlight" in t && t.highlight && "border-transfer/40 bg-transfer-soft/40")}
          >
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="text-xs">{t.label}</span>
                <t.icon className="size-4 shrink-0" />
              </div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{t.value}</p>
              <p className="text-xs leading-snug text-muted-foreground">{t.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {d.tiles.waiting.value > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-transfer/30 bg-transfer-soft/40 px-4 py-3 text-sm">
          <span>
            <strong className="font-medium">{d.tiles.waiting.value} suggested matches</strong> are waiting for
            a company decision.
          </span>
          <Button size="sm" nativeButton={false} render={<Link href="/company/candidates" />}>
            Review candidates <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="From suggestion to follow-up"
          description="How many pairs reached each stage. The percentage is the share of the stage before."
          table={{
            columns: ["Stage", "Pairs", "Of previous stage"],
            rows: d.funnel.map((s) => [
              s.stage,
              s.value,
              s.fromPrevious === null ? "–" : `${s.fromPrevious}%`,
            ]),
          }}
        >
          <HBars
            max={funnelMax}
            rows={d.funnel.map((s) => ({
              key: s.stage,
              label: s.stage,
              sub: s.fromPrevious === null ? undefined : `${s.fromPrevious}% of previous`,
              value: s.value,
              tip: `${s.stage}: ${s.value} pairs`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Company decisions per need"
          description="Suggested matches each company invited, passed on or still has to look at, across the event."
          legend={DECISIONS}
          table={{
            columns: ["Need", "Approved", "Waiting", "Rejected"],
            rows: d.decisionsPerNeed.map((n) => [`${n.label} · ${n.sub}`, n.approved, n.waiting, n.rejected]),
          }}
        >
          <StackedHBars
            series={DECISIONS}
            rows={d.decisionsPerNeed.map((n) => ({
              key: n.id,
              label: n.label,
              sub: n.sub,
              values: { approved: n.approved, waiting: n.waiting, rejected: n.rejected },
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Meetings booked per time slot"
          description={`${EVENT.date}, ${EVENT.time}. ${d.slotLoad.tables} tables can each hold one meeting per slot.`}
          table={{
            columns: ["Time", "Meetings booked", "Free tables"],
            rows: d.slotLoad.slots.map((s) => [s.time, s.booked, d.slotLoad.tables - s.booked]),
          }}
        >
          <Columns
            unit="meetings booked"
            max={slotMax}
            items={d.slotLoad.slots.map((s) => ({
              key: s.time,
              label: s.time,
              value: s.booked,
              tip: `${s.time}: ${s.booked} booked, ${d.slotLoad.tables - s.booked} tables free`,
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Most common skills at the event"
          description="How many registered people have each skill, and how many showed it in their own answers."
          legend={SKILLS}
          table={{
            columns: ["Skill", "Shown in answers", "Stated only"],
            rows: d.skills.map((s) => [s.label, s.shown, s.stated]),
          }}
        >
          <StackedHBars
            series={SKILLS}
            rows={d.skills.map((s) => ({
              key: s.id,
              label: s.label,
              values: { shown: s.shown, stated: s.stated },
            }))}
          />
        </ChartCard>

        <ChartCard
          title="Is every group treated alike?"
          description="For each group, how often its members get suggested, compared with the best-served group. Below 80% needs a closer look."
          table={{
            columns: ["Compared by", "Lowest vs highest", "Result"],
            rows: d.fairness.map((f) => [
              f.dimension,
              `${Math.round(f.ratio * 100)}%`,
              f.ok ? "Balanced" : "Check",
            ]),
          }}
        >
          <HBars
            max={1}
            format={(n) => `${Math.round(n * 100)}%`}
            reference={{ value: 0.8, label: "80% line: below it, check for bias" }}
            rows={d.fairness.map((f) => ({
              key: f.dimension,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {f.ok ? (
                    <CircleCheckIcon className="size-3.5 text-evidence" aria-label="Balanced" />
                  ) : (
                    <CircleAlertIcon className="size-3.5 text-transfer" aria-label="Check" />
                  )}
                  {f.dimension}
                </span>
              ),
              sub: f.ok ? "Balanced" : "Check",
              value: f.ratio,
              tip: `${f.lowest.group}: ${Math.round(f.lowest.rate * 100)}% suggested · ${f.highest.group}: ${Math.round(f.highest.rate * 100)}%`,
            }))}
          />
          <p className="text-xs text-muted-foreground">
            Matching only reads skills.{" "}
            <Link href="/responsible" className="text-primary underline-offset-4 hover:underline">
              See the full fairness check
            </Link>
          </p>
        </ChartCard>

        <ChartCard
          title="How the meetings went"
          description={`Average answers from both sides after ${d.feedback.held} ${d.feedback.held === 1 ? "meeting" : "meetings"}. Ratings are about the meeting and the cards, never the person.`}
          table={{
            columns: ["Question", "Average"],
            rows: d.feedback.ratings.map((r) => [r.label, fmtRating(r.value)]),
          }}
        >
          <HBars
            max={5}
            color={CHART.green}
            format={(n) => (n ? `${n.toFixed(1)} / 5` : "–")}
            rows={d.feedback.ratings.map((r) => ({
              key: r.label,
              label: r.label,
              value: r.value ?? 0,
              tip: r.value === null ? "No answers yet" : `${r.label}: ${fmtRating(r.value)}`,
            }))}
          />
          <dl className="grid grid-cols-3 gap-3 border-t pt-3 text-center">
            {[
              ["Interviews agreed", d.feedback.interviews],
              ["No-shows", d.feedback.noShows],
              [
                "Both sides answered",
                d.feedback.responseRate === null ? "–" : `${Math.round(d.feedback.responseRate * 100)}%`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </ChartCard>
      </div>
    </div>
  );
}
