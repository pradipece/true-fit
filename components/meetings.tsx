"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRightIcon,
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
import { feedbackError, NEXT_STEPS, pairOutcome, QUESTIONS } from "@/lib/impact";
import type { FeedbackSide, NextStep, SideFeedback } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MeetingSide = "company" | "talent";

const OTHER: Record<MeetingSide, string> = { company: "the candidate", talent: "the company" };

/**
 * One side's view of the meetings. Company and candidate each get their own route
 * (/meetings/company, /meetings/talent) and only see their own answers.
 */
export function Meetings({ side }: { side: MeetingSide }) {
  const { needs, talent, decisions, optIns, slots, feedback, setOptIn, bookSlot, cancelSlot, giveFeedback } =
    useDemo();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const selected = searchParams.get("pair");
  const current = pairs.find((p) => p.key === selected) ?? pairs[0];
  const select = (key: string) =>
    router.replace(`/meetings/${side}?pair=${encodeURIComponent(key)}`, { scroll: false });

  if (!current) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-muted-foreground">
            No approved matches yet. The organiser reviews every suggestion before anything reaches you.
          </p>
          <Button variant="outline" nativeButton={false} render={<Link href="/organiser" />}>
            Switch to the organiser view (demo)
          </Button>
        </CardContent>
      </Card>
    );
  }

  const o = optIns[current.key] ?? {};
  const mine = o[side];
  const status = pairStatus(o, slots[current.key]);
  const mutual = status === "mutual" || status === "booked";
  const declined = status === "declined";
  const slot = slots[current.key];
  const availability = slotAvailability(current.key, slots, needs);
  const firstFree = earliestFree(availability);
  const room = roomFor(current.need, needs);
  const fb = feedback[current.key];
  const talentName = mutual ? current.t.revealName : current.t.alias;
  const me = side === "company" ? current.need.company : talentName;
  const otherSide: MeetingSide = side === "company" ? "talent" : "company";
  const agendaId = side === "company" ? companyOf(current.need) : current.t.id;

  const answer = (v: OptInAnswer) => {
    const other = o[otherSide];
    setOptIn(current.key, side, v);
    if (v === true && other === true) toast.success("It's mutual! Identities revealed. Pick a slot.");
    else if (v === true) toast(`Saved. You'll hear back when ${OTHER[side]} answers.`);
    else if (v === false)
      toast(
        `Declined. ${OTHER[side][0].toUpperCase() + OTHER[side].slice(1)} is not told who said no, or why.`,
      );
    else if (v === undefined && slot) toast("Withdrawn. The booked slot was released.");
  };

  const book = (time: string) => {
    bookSlot(current.key, time);
    toast.success(`Booked ${time} · ${room.label}`, { description: "Added to both agendas." });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <p className="px-1 text-xs font-medium text-muted-foreground">
          {side === "company" ? "Candidates suggested to companies" : "Companies suggested to candidates"}
        </p>
        {pairs.map((p) => {
          const po = optIns[p.key] ?? {};
          const ps = pairStatus(po, slots[p.key]);
          const pm = ps === "mutual" || ps === "booked";
          const label = feedback[p.key]?.[side]
            ? "Feedback sent"
            : ps === "waiting" && po[side] !== undefined
              ? `Waiting for ${OTHER[side]}`
              : STATUS_LABEL[ps](slots[p.key]);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => select(p.key)}
              className={cn(
                "w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50",
                current.key === p.key && "border-primary ring-2 ring-primary/20",
              )}
            >
              <p className="truncate text-sm font-medium">
                {side === "company" ? (pm ? p.t.revealName : p.t.alias) : p.need.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {side === "company"
                  ? `for ${p.need.company} · ${p.need.title}`
                  : `${p.need.company} · as ${pm ? p.t.revealName : p.t.alias}`}
              </p>
              <div className="mt-2 flex items-center gap-1.5">
                <Dot value={po[side]} label="Your answer" />
                <span className="ml-auto text-xs text-muted-foreground">{label}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {/* Step A: opt in */}
        <section className="space-y-3">
          <StepTitle
            n="A"
            title={
              side === "company" ? "Do you want to meet this candidate?" : "Do you want to meet this company?"
            }
            done={mutual}
          >
            You see why the match was suggested. {side === "company" ? "Their name" : "Your name"} is revealed
            only when both sides say yes, and nobody is told who said no.
          </StepTitle>
          {side === "company" ? (
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <Building2Icon className="size-3.5" /> {current.need.company} · {current.need.title}
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-base">
                  {mutual ? (
                    <EyeIcon className="size-4 text-evidence" />
                  ) : (
                    <EyeOffIcon className="size-4 text-muted-foreground" />
                  )}
                  {talentName}
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
                <OptInButtons value={mine} onChange={answer} />
              </CardFooter>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <UserRoundIcon className="size-3.5" /> Suggested to {talentName}
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
                <OptInButtons value={mine} onChange={answer} />
              </CardFooter>
            </Card>
          )}
          {mine === true && status === "waiting" && (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              Waiting for {OTHER[side]} to answer. You&apos;ll be notified if it&apos;s mutual.
            </p>
          )}
          {declined && (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No meeting this time. Neither side is told who said no or why, and both can still be matched for
              other matches.
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            <Button
              size="xs"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/meetings/agenda/${agendaId}`} />}
            >
              <CalendarDaysIcon data-icon="inline-start" /> Your agenda
            </Button>
            <Button
              size="xs"
              variant="ghost"
              nativeButton={false}
              render={<Link href={`/meetings/${otherSide}?pair=${encodeURIComponent(current.key)}`} />}
            >
              <ArrowLeftRightIcon data-icon="inline-start" /> Demo: switch to the{" "}
              {otherSide === "company" ? "company" : "candidate"}&apos;s view
            </Button>
          </div>
        </section>

        {/* Step B: slot */}
        <section className={cn("space-y-3", !mutual && "pointer-events-none opacity-50")}>
          <StepTitle n="B" title={`Book a ${EVENT.slotMinutes}-minute slot`} done={!!slot}>
            The schedule is generated before the event and served as static files, so the login rush at the
            start can&apos;t overload it. A time is only blocked if{" "}
            {side === "company" ? "you or the candidate" : "you or the company"} are busy.
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
                {availability.map((a) => {
                  const mineBusy = (a.reason === "company") === (side === "company");
                  return (
                    <Button
                      key={a.time}
                      variant={a.mine ? "default" : "outline"}
                      disabled={!a.free}
                      title={
                        a.free
                          ? undefined
                          : mineBusy
                            ? `You already have a meeting at ${a.time}`
                            : `${OTHER[side]} is busy at ${a.time}`
                      }
                      className="h-auto flex-col gap-0 py-1.5 tabular-nums"
                      onClick={() => book(a.time)}
                    >
                      <span className={cn(!a.free && "line-through")}>{a.time}</span>
                      {!a.free && (
                        <span className="text-[10px] font-normal no-underline">
                          {mineBusy ? "you're busy" : side === "company" ? "candidate busy" : "company busy"}
                        </span>
                      )}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Step C: feedback */}
        <section className={cn("space-y-3", !slot && "pointer-events-none opacity-50")}>
          <StepTitle n="C" title="After the meeting: 30-second feedback" done={!!fb?.[side]}>
            You answer on your own. It rates the meeting and the cards, never the person, and helps the
            organiser report impact and improve the next event.
          </StepTitle>
          {fb?.company && fb?.talent && (
            <p className="rounded-lg border border-evidence/30 bg-evidence-soft p-3 text-sm text-evidence">
              {OUTCOME_LABEL[pairOutcome(fb)]}
            </p>
          )}
          <div className="max-w-xl">
            <FeedbackForm
              key={`${current.key}:${side}`}
              side={side}
              who={me}
              initial={fb?.[side]}
              onSubmit={(f) => {
                giveFeedback(current.key, side, f);
                toast.success("Thanks, feedback saved", {
                  description: "Your answers are shared with the organiser, not with the other side.",
                });
              }}
            />
          </div>
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

const OUTCOME_LABEL: Record<ReturnType<typeof pairOutcome>, string> = {
  awaiting: "Waiting for both answers.",
  "no-show": "The meeting didn't take place.",
  interview: "Both want to continue: an interview is next.",
  "follow-up": "Both are open to keeping in touch.",
  "no-follow-up": "No follow-up this time. Thanks for meeting!",
};

function Stars({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of 5`}
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <StarIcon
            className={cn("size-6", n <= value ? "fill-transfer text-transfer" : "text-muted-foreground/40")}
          />
        </button>
      ))}
    </div>
  );
}

function FeedbackForm({
  side,
  who,
  initial,
  onSubmit,
}: {
  side: FeedbackSide;
  who: string;
  initial?: SideFeedback;
  onSubmit: (f: SideFeedback) => void;
}) {
  const [held, setHeld] = useState<boolean | undefined>(initial?.held);
  const [usefulness, setUsefulness] = useState(initial?.usefulness ?? 0);
  const [accuracy, setAccuracy] = useState(initial?.accuracy ?? 0);
  const [next, setNext] = useState<NextStep | undefined>(initial?.nextStep);
  const [improve, setImprove] = useState(initial?.improve ?? "");
  const draft: Partial<SideFeedback> = { held, usefulness, accuracy, nextStep: next };
  const error = feedbackError(draft);
  const q = QUESTIONS[side];

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {side === "company" ? (
            <Building2Icon className="size-3.5" />
          ) : (
            <UserRoundIcon className="size-3.5" />
          )}
          {who} answers
        </CardDescription>
        <CardTitle className="text-base">
          {side === "company" ? "Company feedback" : "Candidate feedback"}
        </CardTitle>
        {initial && (
          <Badge
            variant="outline"
            className="col-start-2 row-span-2 row-start-1 self-start justify-self-end font-normal"
          >
            <CheckCircle2Icon data-icon="inline-start" /> Sent
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm">Did the meeting take place?</p>
          <div className="flex gap-1.5">
            <Button size="sm" variant={held === true ? "default" : "outline"} onClick={() => setHeld(true)}>
              Yes
            </Button>
            <Button size="sm" variant={held === false ? "default" : "outline"} onClick={() => setHeld(false)}>
              No, it didn&apos;t happen
            </Button>
          </div>
        </div>
        {held && (
          <>
            <div className="space-y-1.5">
              <p className="text-sm">{q.usefulness}</p>
              <Stars value={usefulness} onChange={setUsefulness} label={q.usefulness} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm">{q.accuracy}</p>
              <Stars value={accuracy} onChange={setAccuracy} label={q.accuracy} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm">What happens next?</p>
              <div className="flex flex-wrap gap-1.5">
                {NEXT_STEPS[side].map((s) => (
                  <Button
                    key={s.value}
                    size="sm"
                    variant={next === s.value ? "default" : "outline"}
                    onClick={() => setNext(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Only the organiser sees this. The other side is not told.
              </p>
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`improve-${side}`}>
            What should the organiser do differently next time? (optional)
          </Label>
          <Textarea
            id={`improve-${side}`}
            value={improve}
            onChange={(e) => setImprove(e.target.value)}
            rows={2}
            placeholder="About the event, not the person. No names needed."
          />
        </div>
      </CardContent>
      <CardFooter className="gap-3">
        <Button
          disabled={!!error}
          onClick={() =>
            onSubmit({
              held: !!held,
              ...(held && { usefulness, accuracy, nextStep: next }),
              improve: improve.trim() || undefined,
              at: new Date().toISOString(),
            })
          }
        >
          {initial ? "Update feedback" : "Send feedback"}
        </Button>
        {error && <span className="text-xs text-muted-foreground">{error}</span>}
      </CardFooter>
    </Card>
  );
}
