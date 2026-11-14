"use client";

import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  DownloadIcon,
  HourglassIcon,
  MapPinIcon,
  PrinterIcon,
  UserRoundIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT } from "@/lib/data";
import { agendaFor, agendaIcs, type AgendaItem, type Participant } from "@/lib/schedule";
import { useDemo } from "@/lib/store";

/**
 * One participant's agenda for the event day. The page shell is prerendered for every
 * participant at build time; the bookings fill in on the device.
 */
export function Agenda({ who, name }: { who: Participant; name: string }) {
  const { needs, talent, decisions, optIns, slots } = useDemo();
  const approved = Object.entries(decisions)
    .filter(([, d]) => d.status === "approved")
    .map(([k]) => k);
  const items = agendaFor(who, approved, needs, talent, optIns, slots);
  const booked = items.filter((i) => i.status === "booked");
  const toAnswer = items.filter((i) => i.status === "waiting" && i.myAnswer === undefined);
  const waitingOther = items.filter((i) => i.status === "waiting" && i.myAnswer === true);
  const toBook = items.filter((i) => i.status === "mutual");
  const declined = items.filter((i) => i.status === "declined").length;

  const download = () => {
    const blob = new Blob([agendaIcs(booked, name)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "truefit-agenda.ics" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5">
            <CalendarDaysIcon className="size-3.5" /> {EVENT.date} · {EVENT.time} · {EVENT.place}
          </CardDescription>
          <CardTitle className="text-lg">Your meetings ({booked.length})</CardTitle>
          <div className="col-start-2 row-span-2 row-start-1 flex gap-2 self-start justify-self-end print:hidden">
            <Button size="sm" variant="outline" onClick={download} disabled={!booked.length}>
              <DownloadIcon data-icon="inline-start" /> Add to calendar
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <PrinterIcon data-icon="inline-start" /> Print
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {booked.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No meetings booked yet. When both sides say yes, a {EVENT.slotMinutes}-minute slot appears here.
            </p>
          ) : (
            <ol className="relative space-y-3 border-l pl-5">
              {booked.map((i) => (
                <li key={i.key} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1 font-semibold tabular-nums">
                      <ClockIcon className="size-3.5 text-muted-foreground" /> {i.time}
                    </span>
                    <span className="font-medium">{i.counterpart}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{i.needTitle}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPinIcon className="size-3" /> {i.room} · {EVENT.slotMinutes} minutes
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4 print:hidden">
        <Group
          title="Waiting for your answer"
          empty="Nothing to answer."
          items={toAnswer}
          action={
            toAnswer.length > 0 && (
              <Button size="sm" nativeButton={false} render={<Link href="/meetings" />}>
                Answer now <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )
          }
        />
        <Group
          title="Ready to book a time"
          empty="None right now."
          items={toBook}
          action={
            toBook.length > 0 && (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/meetings" />}>
                Pick a slot <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )
          }
        />
        <Group title="Waiting for the other side" empty="None." items={waitingOther} />
        {declined > 0 && (
          <p className="px-1 text-xs text-muted-foreground">
            {declined} {declined === 1 ? "match is" : "matches are"} not going ahead. Nobody is told who said
            no.
          </p>
        )}
      </div>
    </div>
  );
}

function Group({
  title,
  empty,
  items,
  action,
}: {
  title: string;
  empty: string;
  items: AgendaItem[];
  action?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <HourglassIcon className="size-3.5 text-muted-foreground" /> {title}
          <Badge variant="secondary" className="tabular-nums">
            {items.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((i) => (
              <li key={i.key} className="flex items-start gap-1.5 text-sm">
                <UserRoundIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span>
                  {i.counterpart} <span className="text-muted-foreground">· {i.needTitle}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {action}
      </CardContent>
    </Card>
  );
}
