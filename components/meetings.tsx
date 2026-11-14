"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2Icon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MapPinIcon,
  StarIcon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MatchExplanationView } from "@/components/match-explanation";
import { SkillChip } from "@/components/skill-chip";
import { EVENT } from "@/lib/data";
import { explainMatch } from "@/lib/match";
import {
  companyOf,
  earliestFree,
  pairStatus,
  roomFor,
  slotAvailability,
  type OptInAnswer,
  type PairStatus,
} from "@/lib/schedule";
import { useDemo } from "@/lib/store";
import type { Feedback } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Meetings() {
  const { needs, talent, decisions, optIns, slots, feedback, setOptIn, bookSlot, cancelSlot, giveFeedback } =
    useDemo();

  const pairs = useMemo(
    () =>
      Object.entries(decisions)
        .filter(([, d]) => d.status === "approved")
        .map(([key, d]) => {
          const [needId, talentId] = key.split("::");
          const need = needs.find((n) => n.id === needId);
          const t = talent.find((x) => x.id === talentId);
          return need && t ? { key, need, t, d, m: explainMatch(need, t) } : null;
        })
        .filter((x) => x !== null),
    [decisions, needs, talent],
  );

  const [selected, setSelected] = useState<string | null>(null);
  const current = pairs.find((p) => p.key === selected) ?? pairs[0];

  if (!current) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-muted-foreground">No approved matches yet.</p>
          <Button nativeButton={false} render={<Link href="/organiser" />}>
            Approve matches in the organiser dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const o = optIns[current.key] ?? {};
  const status = pairStatus(o, slots[current.key]);
  const mutual = status === "mutual" || status === "booked";
  const declined = status === "declined";
  const slot = slots[current.key];
  const availability = slotAvailability(current.key, slots, needs);
  const firstFree = earliestFree(availability);
  const room = roomFor(current.need, needs);
  const fb = feedback[current.key];

  const answer = (side: "company" | "talent", v: OptInAnswer) => {
    const other = side === "company" ? o.talent : o.company;
    setOptIn(current.key, side, v);
    if (v === true && other === true) toast.success("It's mutual! Identities revealed. Pick a slot.");
    else if (v === false) toast("Declined. Nobody is told who said no, or why.");
    else if (v === undefined && slot) toast("Withdrawn. The booked slot was released.");
  };

  const book = (time: string) => {
    bookSlot(current.key, time);
    toast.success(`Booked ${time} · ${room.label}`, { description: "Added to both agendas." });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">Approved matches</p>
        {pairs.map((p) => {
          const po = optIns[p.key] ?? {};
          const ps = pairStatus(po, slots[p.key]);
          const label = feedback[p.key] ? "Feedback in" : STATUS_LABEL[ps](slots[p.key]);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelected(p.key)}
              className={cn(
                "w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50",
                current.key === p.key && "border-primary ring-2 ring-primary/20",
              )}
            >
              <p className="truncate text-sm font-medium">{p.need.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.need.company} × {ps === "mutual" || ps === "booked" ? p.t.revealName : p.t.alias}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <Dot value={po.company} label="Company" />
                <Dot value={po.talent} label="Talent" />
                <span className="ml-auto text-xs text-muted-foreground">{label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {/* Step A: mutual opt-in */}
        <section className="space-y-3">
          <StepTitle n="A" title="Mutual opt-in" done={mutual}>
            Each side sees why the match was suggested. Identities are revealed only when both say yes.
          </StepTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {/* Company view */}
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <Building2Icon className="size-3.5" /> {current.need.company} sees
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-base">
                  {mutual ? (
                    <EyeIcon className="size-4 text-evidence" />
                  ) : (
                    <EyeOffIcon className="size-4 text-muted-foreground" />
                  )}
                  {mutual ? current.t.revealName : current.t.alias}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{current.t.headline}</p>
                <MatchExplanationView m={current.m} />
                {current.d.note && (
                  <p className="rounded-lg bg-accent p-2.5 text-xs text-accent-foreground">
                    Organiser note: {current.d.note}
                  </p>
                )}
              </CardContent>
              <CardFooter className="gap-2">
                <OptInButtons value={o.company} onChange={(v) => answer("company", v)} />
              </CardFooter>
            </Card>

            {/* Talent view */}
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <UserRoundIcon className="size-3.5" /> {mutual ? current.t.revealName : current.t.alias}{" "}
                  sees
                </CardDescription>
                <CardTitle className="text-base">{current.need.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  {current.need.company}{" "}
                  <span className="text-muted-foreground">· {current.need.companyBlurb}</span>
                </p>
                <p className="text-sm text-muted-foreground">{current.need.summary}</p>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Why you were suggested</p>
                  <div className="flex flex-wrap gap-1.5">
                    {current.m.shared.map((s) => (
                      <SkillChip key={s.skill} id={s.skill} kind={s.level} must={s.must} />
                    ))}
                    {current.m.transferable.map((t) => (
                      <SkillChip key={t.to} id={t.to} from={t.from} kind="transfer" must={t.must} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{current.need.mode}</span>
                  <span>{current.need.language}</span>
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <OptInButtons value={o.talent} onChange={(v) => answer("talent", v)} />
              </CardFooter>
            </Card>
          </div>
          {declined && (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No meeting this time. Neither side is told who said no or why, and both stay in the pool for
              other matches.
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="self-center text-muted-foreground">Agendas:</span>
            <Button
              size="xs"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/meetings/agenda/${companyOf(current.need)}`} />}
            >
              <CalendarDaysIcon data-icon="inline-start" /> {current.need.company}
            </Button>
            <Button
              size="xs"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/meetings/agenda/${current.t.id}`} />}
            >
              <CalendarDaysIcon data-icon="inline-start" /> {mutual ? current.t.revealName : current.t.alias}
            </Button>
          </div>
        </section>

        {/* Step B: slot */}
        <section className={cn("space-y-3", !mutual && "pointer-events-none opacity-50")}>
          <StepTitle n="B" title={`Book a ${EVENT.slotMinutes}-minute slot`} done={!!slot}>
            The schedule is generated before the event and served as static files, so the login rush at the
            start can&apos;t overload it. A time is only blocked if this company or this candidate is busy.
          </StepTitle>
          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <ClockIcon className="size-4" /> {EVENT.date}, {EVENT.time}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPinIcon className="size-4" /> {room.label}
                </span>
                {!mutual && (
                  <span className="flex items-center gap-1.5">
                    <LockIcon className="size-4" /> Unlocks when both say yes
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {slot ? (
                  <>
                    <Badge className="bg-evidence text-white">
                      <CheckCircle2Icon data-icon="inline-start" /> Booked {slot} · {room.label}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => cancelSlot(current.key)}>
                      Cancel booking
                    </Button>
                  </>
                ) : (
                  firstFree && (
                    <Button size="sm" onClick={() => book(firstFree)}>
                      Book earliest free time ({firstFree})
                    </Button>
                  )
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {availability.map((a) => (
                  <Button
                    key={a.time}
                    variant={a.mine ? "default" : "outline"}
                    disabled={!a.free}
                    title={
                      a.reason === "company"
                        ? `${current.need.company} already has a meeting at ${a.time}`
                        : a.reason === "candidate"
                          ? `The candidate already has a meeting at ${a.time}`
                          : undefined
                    }
                    className="h-auto flex-col gap-0 py-1.5 tabular-nums"
                    onClick={() => book(a.time)}
                  >
                    <span className={cn(!a.free && "line-through")}>{a.time}</span>
                    {!a.free && (
                      <span className="text-[10px] font-normal no-underline">
                        {a.reason === "company" ? "company busy" : "candidate busy"}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Pre-generated schedule:{" "}
                <a
                  href="/api/schedule"
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  /api/schedule
                </a>{" "}
                (static JSON). Agenda pages are prerendered for every participant.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Step C: feedback */}
        <section className={cn("space-y-3", !slot && "pointer-events-none opacity-50")}>
          <StepTitle n="C" title="After the meeting: 30-second feedback" done={!!fb}>
            Helps the organiser improve the next event and report impact. It doesn&apos;t rate people.
          </StepTitle>
          <FeedbackForm
            key={current.key}
            initial={fb}
            onSubmit={(f) => {
              giveFeedback(current.key, f);
              toast.success("Thanks, feedback saved");
            }}
          />
        </section>
      </div>
    </div>
  );
}

function Dot({ value, label }: { value: OptInAnswer; label: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px]",
        value === true ? "text-evidence" : value === false ? "text-destructive" : "text-muted-foreground",
      )}
      title={`${label}: ${value === true ? "yes" : value === false ? "declined" : "no answer yet"}`}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          value === true ? "bg-evidence" : value === false ? "bg-destructive" : "bg-muted-foreground/40",
        )}
      />
      {label}
    </span>
  );
}

const STATUS_LABEL: Record<PairStatus, (slot?: string) => string> = {
  waiting: () => "Awaiting answers",
  declined: () => "Not going ahead",
  mutual: () => "Pick a slot",
  booked: (slot) => `Booked ${slot}`,
};

function StepTitle({
  n,
  title,
  done,
  children,
}: {
  n: string;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
          done && "border-evidence bg-evidence text-white",
        )}
      >
        {done ? <CheckCircle2Icon className="size-4" /> : n}
      </span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function OptInButtons({ value, onChange }: { value: OptInAnswer; onChange: (v: OptInAnswer) => void }) {
  if (value === true)
    return (
      <>
        <Badge className="bg-evidence text-white">
          <CheckCircle2Icon data-icon="inline-start" /> Opted in
        </Badge>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onChange(undefined)}>
          Withdraw
        </Button>
      </>
    );
  if (value === false)
    return (
      <>
        <Badge variant="secondary">Declined</Badge>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onChange(undefined)}>
          Change my mind
        </Button>
      </>
    );
  return (
    <>
      <Button size="sm" onClick={() => onChange(true)}>
        Yes, I&apos;d like to meet
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onChange(false)}>
        No, thanks
      </Button>
    </>
  );
}

function FeedbackForm({ initial, onSubmit }: { initial?: Feedback; onSubmit: (f: Feedback) => void }) {
  const [accuracy, setAccuracy] = useState(initial?.evidenceAccuracy ?? 0);
  const [next, setNext] = useState<Feedback["nextStep"] | null>(initial?.nextStep ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm">Did the skill card reflect what you heard in the meeting?</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} of 5`}
                onClick={() => setAccuracy(n)}
                className="rounded p-0.5 transition-transform hover:scale-110"
              >
                <StarIcon
                  className={cn(
                    "size-6",
                    n <= accuracy ? "fill-transfer text-transfer" : "text-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm">Agreed next step</p>
          <div className="flex flex-wrap gap-1.5">
            {(["Interview", "Keep in touch", "Not a fit"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={next === s ? "default" : "outline"}
                onClick={() => setNext(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fb-comment">What should the organiser do differently next time? (optional)</Label>
          <Textarea id="fb-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          disabled={!accuracy || !next}
          onClick={() => next && onSubmit({ evidenceAccuracy: accuracy, nextStep: next, comment })}
        >
          {initial ? "Update feedback" : "Send feedback"}
        </Button>
      </CardFooter>
    </Card>
  );
}
