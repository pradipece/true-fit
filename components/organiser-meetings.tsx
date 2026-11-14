"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BellIcon,
  CalendarCheckIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  HandshakeIcon,
  HourglassIcon,
  MonitorIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EVENT } from "@/lib/data";
import { pairOutcome, type PairOutcome } from "@/lib/impact";
import { companyOf, pairStatus, rooms, roomFor, SLOT_TIMES, type PairStatus } from "@/lib/schedule";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * The organiser's event-day view: every approved pair, where it stands, and the
 * event-day schedule per table. Read-only on purpose: only the two sides can opt in,
 * book or give feedback. Candidates appear by alias, and a decline never says who declined.
 */

const STATUS: Record<PairStatus, { label: string; className: string }> = {
  waiting: { label: "Awaiting answers", className: "border-dashed text-muted-foreground" },
  declined: { label: "Not going ahead", className: "bg-secondary text-secondary-foreground" },
  mutual: { label: "Both said yes", className: "border-transfer/30 bg-transfer-soft text-transfer" },
  booked: { label: "Booked", className: "border-evidence/30 bg-evidence-soft text-evidence" },
};

const OUTCOME: Record<PairOutcome, string> = {
  awaiting: "Feedback pending",
  "no-show": "No-show",
  interview: "Interview agreed",
  "follow-up": "Follow-up agreed",
  "no-follow-up": "No follow-up",
};

export function OrganiserMeetings() {
  const { needs, talent, decisions, optIns, slots, feedback } = useDemo();

  const pairs = useMemo(
    () =>
      Object.entries(decisions)
        .filter(([, d]) => d.status === "approved")
        .map(([key]) => {
          const [needId, talentId] = key.split("::");
          const need = needs.find((n) => n.id === needId);
          const t = talent.find((x) => x.id === talentId);
          if (!need || !t) return null;
          const o = optIns[key] ?? {};
          return { key, need, t, o, slot: slots[key], status: pairStatus(o, slots[key]) };
        })
        .filter((x) => x !== null),
    [decisions, needs, talent, optIns, slots],
  );

  const tables = useMemo(() => rooms(needs), [needs]);
  const byCell = useMemo(() => {
    const m = new Map<string, (typeof pairs)[number]>();
    for (const p of pairs) if (p.status === "booked") m.set(`${companyOf(p.need)}@${p.slot}`, p);
    return m;
  }, [pairs]);

  const count = (s: PairStatus) => pairs.filter((p) => p.status === s).length;
  const booked = pairs.filter((p) => p.status === "booked");
  const held = booked.filter((p) => {
    const f = feedback[p.key];
    return f?.company?.held || f?.talent?.held;
  }).length;

  const stats = [
    { label: "Approved pairs", value: pairs.length, icon: HandshakeIcon },
    { label: "Awaiting answers", value: count("waiting"), icon: HourglassIcon },
    { label: "Both said yes, no slot", value: count("mutual"), icon: CheckCircle2Icon },
    { label: "Meetings booked", value: booked.length, icon: CalendarCheckIcon },
    { label: "Meetings held", value: held, icon: CalendarDaysIcon },
  ];

  const remind = (p: (typeof pairs)[number]) => {
    const who = [p.o.company === undefined && p.need.company, p.o.talent === undefined && p.t.alias]
      .filter(Boolean)
      .join(" and ");
    toast(`Reminder queued for ${who}`, { description: "Demo only: no message is actually sent." });
  };

  if (pairs.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-muted-foreground">No approved matches yet, so there is nothing to schedule.</p>
          <Button nativeButton={false} render={<Link href="/organiser" />}>
            Approve matches in the organiser dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="space-y-1">
              <s.icon className="size-4 text-muted-foreground" />
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event-day schedule</CardTitle>
          <CardDescription>
            {EVENT.date} · {EVENT.time} · {EVENT.slotMinutes}-minute slots. One row per company table or
            online room.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[56rem] border-collapse text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted p-2 text-left font-medium">Table</th>
                  {SLOT_TIMES.map((t) => (
                    <th key={t} className="p-2 text-center font-medium tabular-nums">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tables.map((r) => (
                  <tr key={r.companyId} className="border-t">
                    <th scope="row" className="sticky left-0 z-10 bg-card p-2 text-left font-normal">
                      <Link
                        href={`/meetings/agenda/${r.companyId}`}
                        className="block font-medium hover:underline"
                      >
                        {r.company}
                      </Link>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {r.online && <MonitorIcon className="size-3" />}
                        {r.label}
                      </span>
                    </th>
                    {SLOT_TIMES.map((t) => {
                      const p = byCell.get(`${r.companyId}@${t}`);
                      return (
                        <td key={t} className="border-l p-1 align-top">
                          {p ? (
                            <div
                              className="rounded-md border border-evidence/30 bg-evidence-soft p-1.5 text-evidence"
                              title={`${p.need.title} · ${p.t.alias}`}
                            >
                              <p className="truncate font-medium">{p.t.alias}</p>
                              <p className="truncate opacity-80">{p.need.title}</p>
                            </div>
                          ) : (
                            <span className="sr-only">Free</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All approved pairs</CardTitle>
          <CardDescription>
            You can nudge people who haven&apos;t answered. You can&apos;t answer for them, and when a pair
            doesn&apos;t go ahead you don&apos;t see who said no.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Need · company</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Slot</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairs.map((p) => {
                const waitingOn = [
                  p.o.company === undefined && "company",
                  p.o.talent === undefined && "candidate",
                ].filter(Boolean);
                return (
                  <TableRow key={p.key}>
                    <TableCell>
                      <p className="font-medium">{p.need.title}</p>
                      <p className="text-xs text-muted-foreground">{p.need.company}</p>
                    </TableCell>
                    <TableCell>
                      <Link href={`/meetings/agenda/${p.t.id}`} className="hover:underline">
                        {p.t.alias}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(STATUS[p.status].className)}>
                        {STATUS[p.status].label}
                      </Badge>
                      {p.status === "waiting" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Waiting on {waitingOn.join(" and ")}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.slot ? (
                        <>
                          <p className="font-medium tabular-nums">{p.slot}</p>
                          <p className="text-muted-foreground">{roomFor(p.need, needs).label}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {p.status === "booked" ? OUTCOME[pairOutcome(feedback[p.key])] : "–"}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "waiting" ? (
                        <Button size="sm" variant="outline" onClick={() => remind(p)}>
                          <BellIcon data-icon="inline-start" /> Remind
                        </Button>
                      ) : p.status === "mutual" ? (
                        <span className="text-xs text-muted-foreground">They pick a slot</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
