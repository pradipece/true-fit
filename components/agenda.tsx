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
import { agendaFor, agendaIcs, normSlot, slotLabel, type AgendaItem, type Participant } from "@/lib/schedule";
import { useDemo } from "@/lib/store";

/**
 * One participant's agenda for the interview week. The page shell is prerendered for every
 * participant at build time; the bookings fill in on the device.
 */
export function Agenda({ who, name }: { who: Participant; name: string }) {
  const { needs, talent, decisions, optIns, slots, screening, offers } = useDemo();
  const items = agendaFor(who, { needs, talent, decisions, optIns, slots, screening, offers });
  const booked = items
    .filter((i) => i.bucket === "booked")
    .sort((a, b) => normSlot(a.time!).localeCompare(normSlot(b.time!)));
  const toAnswer = items.filter((i) => i.bucket === "answer");
  const waitingOther = items.filter((i) => i.bucket === "waiting");
  const toBook = items.filter((i) => i.bucket === "book");

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
            <CalendarDaysIcon className="size-3.5" /> Interviews {EVENT.time} · {EVENT.place}
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
              Nothing booked yet. Espoo interviews and company interviews appear here once they have a time.
            </p>
          ) : (
            <ol className="relative space-y-3 border-l pl-5">
              {booked.map((i) => (
                <li key={`${i.kind}:${i.key}`} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary" />
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="flex items-center gap-1 font-semibold tabular-nums">
                      <ClockIcon className="size-3.5 text-muted-foreground" /> {slotLabel(i.time!)}
                    </span>
                    <span className="font-medium">{i.counterpart}</span>
                    <Badge variant="outline" className="font-normal">
                      {i.kind === "espoo" ? "Espoo interview" : "Company interview"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {i.needTitle}
                    {i.kind === "espoo" && ` · ${i.company}`}
                  </p>
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
              <Button size="sm" nativeButton={false} render={<Link href={`/meetings/${who.kind}`} />}>
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
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<Link href={`/meetings/${who.kind}`} />}
              >
                Pick a slot <ArrowRightIcon data-icon="inline-end" />
              </Button>
            )
          }
        />
        <Group title="Waiting for the other side" empty="None." items={waitingOther} />
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
              <li key={`${i.kind}:${i.key}`} className="flex items-start gap-1.5 text-sm">
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
