"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRightIcon,
  BadgeCheckIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  ClockIcon,
  HourglassIcon,
  LandmarkIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  StarIcon,
  UserRoundIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IdentitySwitch, useIdentity, useViewAs } from "@/components/identity";
import { useSwitchAccount } from "@/components/session";
import { MatchExplanationView, ScoreMeter } from "@/components/match-explanation";
import { MiniSteps, Stepper } from "@/components/pipeline-steps";
import { SkillChip } from "@/components/skill-chip";
import { EVENT } from "@/lib/data";
import { pairOwner } from "@/lib/identity";
import { feedbackError, NEXT_STEPS, pairOutcome, QUESTIONS } from "@/lib/impact";
import { explainMatch } from "@/lib/match";
import { participantById } from "@/lib/participants";
import {
  activeKeys,
  COMPANY_LABEL,
  myTurn,
  ownedBy,
  stageOf,
  TALENT_LABEL,
  visibleTo,
  type PairStage,
} from "@/lib/pipeline";
import {
  dayLabel,
  earliestFree,
  ESPOO_DESK,
  slotDay,
  slotLabel,
  slotTime,
  roomFor,
  screeningAvailability,
  slotAvailability,
  type OptInAnswer,
  type SlotState,
} from "@/lib/schedule";
import { useDemo } from "@/lib/store";
import type { FeedbackSide, NextStep, SideFeedback } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MeetingSide = "company" | "talent";

/**
 * One side's view of the recruitment pipeline (lib/pipeline.ts). The candidate follows every
 * step from Espoo's interview invitation to a job offer; the company sees a candidate only
 * after Espoo passes them, then decides on an interview and an offer. Each route
 * (/meetings/company, /meetings/talent) shows only the signed-in participant's own pairs.
 */
export function Meetings({ side }: { side: MeetingSide }) {
  const demo = useDemo();
  const { needs, talent, decisions, optIns, slots, screening, offers, feedback } = demo;
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewAs = useViewAs();
  const { id: myId } = useIdentity(side);
  const { switchTo } = useSwitchAccount();

  const state = useMemo(
    () => ({ decisions, optIns, slots, screening, offers }),
    [decisions, optIns, slots, screening, offers],
  );
  const mine = useMemo(
    () => activeKeys(state).filter((k) => ownedBy(side, myId, k, needs)),
    [state, side, myId, needs],
  );
  const pairs = useMemo(
    () =>
      mine
        .filter((k) => visibleTo(side, k, state))
        .map((key) => {
          const [needId, talentId] = key.split("::");
          const need = needs.find((n) => n.id === needId);
          const t = talent.find((x) => x.id === talentId);
          return need && t ? { key, need, t, p: stageOf(key, state), m: explainMatch(need, t) } : null;
        })
        .filter((x) => x !== null)
        // Your move first, finished or stopped last.
        .sort((a, b) => rank(side, a.p) - rank(side, b.p)),
    [mine, state, needs, talent, side],
  );
  // The company's own requests that haven't reached it yet: stage only.
  const requests = useMemo(
    () =>
      side === "company"
        ? mine
            .filter((k) => !visibleTo(side, k, state) && optIns[k]?.company === true)
            .map((key) => {
              const [needId, talentId] = key.split("::");
              return {
                key,
                need: needs.find((n) => n.id === needId),
                t: talent.find((x) => x.id === talentId),
                p: stageOf(key, state),
              };
            })
        : [],
    [side, mine, state, optIns, needs, talent],
  );

  const selected = searchParams.get("pair");
  const current = pairs.find((p) => p.key === selected) ?? pairs[0];
  const select = (key: string) =>
    router.replace(`/meetings/${side}?pair=${encodeURIComponent(key)}`, { scroll: false });
  // A link to a pair of another demo participant (e.g. from the organiser view).
  const foreignOwner =
    selected && !pairs.some((p) => p.key === selected) ? pairOwner(side, selected, needs) : undefined;
  const foreign =
    foreignOwner && foreignOwner !== myId && visibleTo(side, selected!, state) ? foreignOwner : undefined;

  const banner = foreign && (
    <p className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-accent px-3 py-2 text-sm text-accent-foreground">
      This link is for {participantById(foreign)?.name ?? foreign}, not the participant you&apos;re signed in
      as.
      <Button
        size="xs"
        onClick={() => switchTo(side, foreign, `/meetings/${side}?pair=${encodeURIComponent(selected!)}`)}
      >
        Sign in as them (demo)
      </Button>
    </p>
  );

  if (!current) {
    return (
      <div className="space-y-4">
        <IdentitySwitch side={side} />
        {banner}
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-muted-foreground">
              {side === "company"
                ? "No candidates yet. Espoo sends you a candidate's profile once they pass its interview. Ask for anyone on Find candidates."
                : "Nothing yet. Ask to meet a company on Explore roles, or wait for Espoo to invite you to an interview."}
            </p>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={side === "company" ? "/company" : "/talent/explore"} />}
            >
              {side === "company" ? "Find candidates" : "Explore roles"}
            </Button>
          </CardContent>
        </Card>
        {requests.length > 0 && <Requests rows={requests} />}
      </div>
    );
  }

  const { key, need, t, p, m } = current;
  const o = optIns[key] ?? {};
  const sc = screening[key] ?? {};
  const offer = offers[key];
  const slot = slots[key];
  const fb = feedback[key];
  const room = roomFor(need, needs);
  const passed = p.step >= 3;
  const otherSide: MeetingSide = side === "company" ? "talent" : "company";
  const who = side === "company" ? need.company : (t.contact?.fullName ?? t.revealName);

  const companyAvailability = slotAvailability(key, slots, needs, screening);
  const espooAvailability = screeningAvailability(key, slots, screening);

  const answerInterview = (v: OptInAnswer) => {
    demo.setOptIn(key, side, v);
    const other = o[otherSide];
    if (v === true && other === true) toast.success("Both said yes. Pick an interview time.");
    else if (v === true)
      toast(side === "company" ? "Saved. The candidate is asked next." : "Saved. Waiting for the company.");
    else if (v === false) toast("Declined. The other side is not told why.");
    else if (slot) toast("Withdrawn. The booked time was released.");
  };

  return (
    <div className="space-y-4">
      <IdentitySwitch side={side} />
      {banner}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">
            {side === "company" ? "Candidates Espoo sent you" : "Your applications and invitations"}
          </p>
          {pairs.map((x) => {
            const turn = myTurn(side, x.p);
            return (
              <button
                key={x.key}
                type="button"
                onClick={() => select(x.key)}
                className={cn(
                  "w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50",
                  current.key === x.key && "border-primary ring-2 ring-primary/20",
                  x.p.stopped && "opacity-60",
                )}
              >
                <p className="truncate text-sm font-medium">
                  {side === "company" ? (x.t.contact?.fullName ?? x.t.revealName) : x.need.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {side === "company"
                    ? `${Math.round(x.m.score * 100)}% skill match · ${x.need.title}`
                    : `${x.need.company} · ${Math.round(x.m.score * 100)}% skill match`}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <MiniSteps p={x.p} />
                  <span
                    className={cn(
                      "ml-auto truncate text-xs",
                      turn ? "font-medium text-primary" : "text-muted-foreground",
                    )}
                  >
                    {(side === "company" ? COMPANY_LABEL : TALENT_LABEL)[x.p.stage]}
                  </span>
                </div>
              </button>
            );
          })}
          {requests.length > 0 && <Requests rows={requests} />}
        </div>

        <div className="space-y-6">
          {/* Who / what this is about */}
          {side === "company" ? (
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <Building2Icon className="size-3.5" /> {need.company} · {need.title}
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BadgeCheckIcon className="size-4 text-evidence" /> {t.contact?.fullName ?? t.revealName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScoreMeter score={m.score} role={need.title} />
                <p className="text-sm text-muted-foreground">{t.headline}</p>
                {t.contact && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Contact details">
                    <li className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPinIcon className="size-3.5" /> {t.contact.city}
                    </li>
                    <li>
                      <a
                        href={`mailto:${t.contact.email}`}
                        className="flex items-center gap-1.5 hover:underline"
                      >
                        <MailIcon className="size-3.5 text-muted-foreground" /> {t.contact.email}
                      </a>
                    </li>
                    <li>
                      <a
                        href={`tel:${t.contact.phone.replace(/\s+/g, "")}`}
                        className="flex items-center gap-1.5 tabular-nums hover:underline"
                      >
                        <PhoneIcon className="size-3.5 text-muted-foreground" /> {t.contact.phone}
                      </a>
                    </li>
                  </ul>
                )}
                <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  <Fact label="Background" value={t.previousField} />
                  <Fact
                    label="Languages"
                    value={t.languages.map((l) => `${l.lang} (${l.level.toLowerCase()})`).join(", ")}
                  />
                  <Fact label="Prefers" value={t.mode} />
                  <Fact label="Available" value={t.availability} />
                </dl>
                <EspooResult reason={sc.reason} note={sc.note} at={sc.at} />
                <MatchExplanationView m={m} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5">
                  <UserRoundIcon className="size-3.5" /> {who}
                </CardDescription>
                <CardTitle className="text-base">{need.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">
                  {need.company} <span className="text-muted-foreground">· {need.companyBlurb}</span>
                </p>
                <p className="text-sm text-muted-foreground">{need.summary}</p>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Why your skills fit</p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.shared.map((s) => (
                      <SkillChip key={s.skill} id={s.skill} kind={s.level} must={s.must} />
                    ))}
                    {m.transferable.map((x) => (
                      <SkillChip key={x.to} id={x.to} from={x.from} kind="transfer" must={x.must} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{need.mode}</span>
                  <span>{need.language}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Stepper p={p} />

          <div className="flex flex-wrap gap-2 text-xs">
            <Button
              size="xs"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/${side}/agenda`} />}
            >
              <CalendarDaysIcon data-icon="inline-start" /> Your agenda
            </Button>
            {(otherSide === "talent" || passed) && (
              <Button size="xs" variant="ghost" onClick={() => viewAs(otherSide, key)}>
                <ArrowLeftRightIcon data-icon="inline-start" /> Demo: sign in as the{" "}
                {otherSide === "company" ? "company" : "candidate"}&apos;s view
              </Button>
            )}
          </div>

          {/* Steps 2–3: Espoo assessment and interview (the candidate acts; the company only sees the outcome) */}
          {side === "talent" && (
            <section className="space-y-3">
              <StepTitle n="1" title="Espoo interview" done={passed} stopped={p.step <= 2 && p.stopped}>
                The City of Espoo reviews your skill card and invites you to a short {EVENT.slotMinutes}
                -minute interview. Only if you pass does it send your profile and contact details to the
                company.
              </StepTitle>
              <Card>
                <CardContent className="space-y-3">
                  {p.stage === "applied" && (
                    <Note icon={HourglassIcon}>
                      You asked to meet {need.company}. Espoo reviews your skill card and invites you to an
                      interview if your skills fit. No AI decides this.
                    </Note>
                  )}
                  {p.stage === "not-selected" && (
                    <Note icon={CircleSlashIcon}>
                      Espoo won&apos;t take this role forward for you right now
                      {decisions[key]?.reason ? `: ${decisions[key].reason.toLowerCase()}` : ""}. You can
                      still be invited for other roles.
                    </Note>
                  )}
                  {p.stage === "invited" && (
                    <>
                      <p className="text-sm">
                        <LandmarkIcon className="mr-1 inline size-4 text-primary" />
                        Espoo invites you to a {EVENT.slotMinutes}-minute interview about{" "}
                        <span className="font-medium">{need.title}</span> at {need.company}.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        By accepting, you agree that if you pass, Espoo shares your profile, name and contact
                        details with {need.company}. Nothing is shared before that.
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => demo.answerScreening(key, true)}>
                          Accept the invitation
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => demo.answerScreening(key, false)}>
                          No, thanks
                        </Button>
                      </div>
                    </>
                  )}
                  {p.stage === "screen-declined" && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">You declined</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => demo.answerScreening(key, undefined)}
                      >
                        Change my mind
                      </Button>
                    </div>
                  )}
                  {(p.stage === "screen-to-book" || p.stage === "screen-booked") && (
                    <>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <ClockIcon className="size-4" /> {EVENT.time}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPinIcon className="size-4" /> {ESPOO_DESK}
                        </span>
                      </div>
                      {sc.slot ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-evidence text-white">
                            <CheckCircle2Icon data-icon="inline-start" /> Espoo interview {slotLabel(sc.slot)}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => demo.bookScreening(key, undefined)}
                          >
                            Change time
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Espoo records the result after the interview.
                          </span>
                        </div>
                      ) : (
                        <SlotGrid
                          side="talent"
                          availability={espooAvailability}
                          onBook={(time) => {
                            demo.bookScreening(key, time);
                            toast.success(`Espoo interview booked at ${time}`, {
                              description: "Added to your agenda.",
                            });
                          }}
                        />
                      )}
                      <Button size="xs" variant="ghost" onClick={() => demo.answerScreening(key, undefined)}>
                        Withdraw my acceptance
                      </Button>
                    </>
                  )}
                  {p.stage === "not-passed" && (
                    <Note icon={CircleSlashIcon}>
                      Thanks for the interview. Espoo won&apos;t send your profile to {need.company} this time
                      {sc.reason ? `: ${sc.reason.toLowerCase()}` : ""}. Your profile stays open for other
                      roles.
                    </Note>
                  )}
                  {passed && (
                    <p className="flex items-center gap-2 text-sm text-evidence">
                      <BadgeCheckIcon className="size-4" /> You passed the Espoo interview
                      {sc.slot ? ` (${slotLabel(sc.slot)})` : ""}. Espoo sent your profile to {need.company}.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          )}

          {/* Steps 4–5: the company decides, then the interview */}
          <section className={cn("space-y-3", !passed && "pointer-events-none opacity-50")}>
            <StepTitle
              n={side === "talent" ? "2" : "1"}
              title={side === "company" ? "Do you want to interview this candidate?" : "Company interview"}
              done={!!slot}
              stopped={p.stage === "company-passed" || p.stage === "candidate-declined"}
            >
              {side === "company"
                ? "Espoo interviewed this candidate and sent you their profile. Invite them to a 10-minute interview at your table; they say yes or no too. Nobody is told why someone says no."
                : `${need.company} has your profile now and decides whether to interview you. You say yes or no too.`}
            </StepTitle>
            <Card>
              <CardContent className="space-y-3">
                {!passed && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <LockIcon className="size-4" /> Unlocks when the candidate passes the Espoo interview
                  </p>
                )}
                {passed && side === "company" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">Your decision:</span>
                    <AnswerButtons
                      value={o.company}
                      yes="Invite to interview"
                      no="Not now"
                      onChange={answerInterview}
                    />
                  </div>
                )}
                {passed && side === "talent" && o.company === undefined && (
                  <Note icon={HourglassIcon}>Waiting for {need.company} to decide on an interview.</Note>
                )}
                {passed && side === "talent" && o.company === false && (
                  <Note icon={CircleSlashIcon}>
                    {need.company} won&apos;t interview this time. Companies don&apos;t give reasons, and it
                    doesn&apos;t affect other roles.
                  </Note>
                )}
                {passed && side === "talent" && o.company === true && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">{need.company} wants to interview you. Your answer:</span>
                    <AnswerButtons
                      value={o.talent}
                      yes="Yes, let's meet"
                      no="No, thanks"
                      onChange={answerInterview}
                    />
                  </div>
                )}
                {passed && side === "company" && o.company === true && (
                  <p className="text-sm text-muted-foreground">
                    Candidate&apos;s answer:{" "}
                    <span className="font-medium text-foreground">
                      {o.talent === true ? "Yes" : o.talent === false ? "Declined" : "Not yet"}
                    </span>
                    {o.talent === true && optIns[key]?.talent && !slot && " · book a time below"}
                  </p>
                )}

                {o.company === true && o.talent === true && (
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <ClockIcon className="size-4" /> {EVENT.time}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPinIcon className="size-4" /> {room.label}
                      </span>
                    </div>
                    {slot ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-evidence text-white">
                          <CheckCircle2Icon data-icon="inline-start" /> Interview {slotLabel(slot)} ·{" "}
                          {room.label}
                        </Badge>
                        {!offer && (
                          <Button size="sm" variant="ghost" onClick={() => demo.cancelSlot(key)}>
                            Cancel booking
                          </Button>
                        )}
                      </div>
                    ) : (
                      <SlotGrid
                        side={side}
                        availability={companyAvailability}
                        onBook={(time) => {
                          demo.bookSlot(key, time);
                          toast.success(`Interview booked at ${time} · ${room.label}`, {
                            description: "Added to both agendas.",
                          });
                        }}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Step 6: feedback and job offer */}
          <section className={cn("space-y-3", !slot && "pointer-events-none opacity-50")}>
            <StepTitle
              n={side === "talent" ? "3" : "2"}
              title="After the interview: feedback and job offer"
              done={p.hired || offer?.answer !== undefined}
              stopped={p.stage === "no-offer" || p.stage === "offer-declined"}
            >
              {side === "company"
                ? "Give 30-second feedback, then decide whether to offer the job. The candidate answers the offer here."
                : "Give 30-second feedback. If the company offers you the job, you accept or decline it here."}
            </StepTitle>
            {fb?.company && fb?.talent && (
              <p className="rounded-lg border border-evidence/30 bg-evidence-soft p-3 text-sm text-evidence">
                {OUTCOME_LABEL[pairOutcome(fb)]}
              </p>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
              <OfferCard
                side={side}
                company={need.company}
                offer={offer}
                onOffer={(status, note) => {
                  demo.setOffer(key, {
                    status,
                    note: note.trim() || undefined,
                    at: new Date().toISOString(),
                  });
                  toast.success(status === "offered" ? "Job offer sent" : "Saved: no offer", {
                    description:
                      status === "offered" ? "The candidate answers in their own view." : undefined,
                  });
                }}
                onWithdraw={() => demo.setOffer(key, undefined)}
                onAnswer={(v) => {
                  demo.answerOffer(key, v);
                  if (v === true) toast.success("Congratulations! You accepted the offer.");
                  else if (v === false) toast("Offer declined. The company is told you declined, not why.");
                }}
              />
              <FeedbackForm
                key={`${key}:${side}`}
                side={side}
                who={who}
                initial={fb?.[side]}
                onSubmit={(f) => {
                  demo.giveFeedback(key, side, f);
                  toast.success("Thanks, feedback saved", {
                    description: "Your answers are only counted in totals, never shown to the other side.",
                  });
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Your move first, then in progress, then finished or stopped. */
function rank(side: MeetingSide, p: PairStage) {
  if (p.stopped) return 3;
  if (p.hired) return 2;
  return myTurn(side, p) ? 0 : 1;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-muted-foreground">{label}: </dt>
      <dd className="inline">{value}</dd>
    </div>
  );
}

function Note({ icon: Icon, children }: { icon: typeof HourglassIcon; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" /> <span>{children}</span>
    </p>
  );
}

function EspooResult({ reason, note, at }: { reason?: string; note?: string; at?: string }) {
  if (!reason) return null;
  return (
    <p className="rounded-lg bg-evidence-soft p-2.5 text-xs text-evidence">
      <LandmarkIcon className="mr-1 inline size-3.5" />
      Passed the Espoo interview
      {at ? ` on ${new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}:{" "}
      {reason}
      {note ? ` — ${note}` : ""}
    </p>
  );
}

function Requests({
  rows,
}: {
  rows: {
    key: string;
    need?: { title: string };
    t?: { revealName: string; contact?: { fullName: string } };
    p: PairStage;
  }[];
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm">Your requests with Espoo ({rows.length})</CardTitle>
        <CardDescription className="text-xs">
          You see the full profile here once Espoo has interviewed and passed the candidate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.key} className="space-y-1 text-sm">
              <p className="truncate">
                {r.t?.contact?.fullName ?? r.t?.revealName}{" "}
                <span className="text-muted-foreground">· {r.need?.title}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <MiniSteps p={r.p} />
                <span className="truncate text-xs text-muted-foreground">{COMPANY_LABEL[r.p.stage]}</span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SlotGrid({
  side,
  availability,
  onBook,
}: {
  side: MeetingSide;
  availability: SlotState[];
  onBook: (time: string) => void;
}) {
  const first = earliestFree(availability);
  const days = [...new Set(availability.map((a) => slotDay(a.time)))];
  const mine = availability.find((a) => a.mine);
  // Open on the booked day, else the day of the earliest free time.
  const [day, setDay] = useState(() => slotDay(mine?.time ?? first ?? availability[0]?.time ?? ""));
  const why = (a: SlotState) => {
    if (a.reason === "order") return "before Espoo interview";
    const mineBusy = (a.reason === "company") === (side === "company");
    return mineBusy ? "you're busy" : side === "company" ? "candidate busy" : "company busy";
  };
  return (
    <div className="space-y-3">
      {first ? (
        <Button size="sm" onClick={() => onBook(first)}>
          Book earliest free time ({slotLabel(first)})
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">No free time left this week.</p>
      )}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Day">
        {days.map((d) => {
          const free = availability.filter((a) => slotDay(a.time) === d && a.free && !a.mine).length;
          const booked = availability.some((a) => slotDay(a.time) === d && a.mine);
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={day === d}
              onClick={() => setDay(d)}
              className={cn(
                "flex flex-col items-start rounded-lg border px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                day === d && "border-primary bg-accent text-accent-foreground",
              )}
            >
              <span className="font-medium">{dayLabel(d)}</span>
              <span className="text-[11px] text-muted-foreground">
                {booked ? "Booked" : free ? `${free} free` : "Full"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {availability
          .filter((a) => slotDay(a.time) === day)
          .map((a) => (
            <Button
              key={a.time}
              variant={a.mine ? "default" : "outline"}
              disabled={!a.free}
              title={a.free ? slotLabel(a.time) : why(a)}
              className="h-auto flex-col gap-0 py-1.5 tabular-nums"
              onClick={() => onBook(a.time)}
            >
              <span className={cn(!a.free && "line-through")}>{slotTime(a.time)}</span>
              {!a.free && <span className="text-[10px] font-normal">{why(a)}</span>}
            </Button>
          ))}
      </div>
    </div>
  );
}

function OfferCard({
  side,
  company,
  offer,
  onOffer,
  onWithdraw,
  onAnswer,
}: {
  side: MeetingSide;
  company: string;
  offer?: { status: "offered" | "no-offer"; note?: string; answer?: boolean };
  onOffer: (status: "offered" | "no-offer", note: string) => void;
  onWithdraw: () => void;
  onAnswer: (v: OptInAnswer) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <BriefcaseBusinessIcon className="size-3.5" /> {company}
        </CardDescription>
        <CardTitle className="text-base">Job offer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!offer && side === "talent" && (
          <Note icon={HourglassIcon}>Waiting for {company} to decide after the interview.</Note>
        )}
        {!offer && side === "company" && (
          <div className="grid gap-1.5">
            <Label htmlFor="offer-note">Message to the candidate (optional)</Label>
            <Textarea
              id="offer-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Start in January, 6-month contract, salary range in the email."
            />
          </div>
        )}
        {offer?.status === "no-offer" && (
          <Note icon={CircleSlashIcon}>
            {side === "company"
              ? "You decided not to offer the job this time."
              : `${company} won't offer the job this time. Thank you for interviewing.`}
          </Note>
        )}
        {offer?.status === "offered" && (
          <>
            <p className="flex items-center gap-2 font-medium text-evidence">
              <BadgeCheckIcon className="size-4" />{" "}
              {side === "company" ? "You offered the job." : `${company} offers you the job!`}
            </p>
            {offer.note && <p className="rounded-lg bg-muted p-2.5 text-xs">{offer.note}</p>}
            <p className="text-muted-foreground">
              {side === "company" ? "Candidate's answer: " : "Your answer: "}
              <span className="font-medium text-foreground">
                {offer.answer === true ? "Accepted" : offer.answer === false ? "Declined" : "Not yet"}
              </span>
            </p>
          </>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {!offer && side === "company" && (
          <>
            <Button size="sm" onClick={() => onOffer("offered", note)}>
              Offer the job
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOffer("no-offer", note)}>
              No offer
            </Button>
          </>
        )}
        {offer && side === "company" && offer.answer === undefined && (
          <Button size="sm" variant="ghost" onClick={onWithdraw}>
            Change decision
          </Button>
        )}
        {offer?.status === "offered" && side === "talent" && (
          <AnswerButtons value={offer.answer} yes="Accept the offer" no="Decline" onChange={onAnswer} />
        )}
      </CardFooter>
    </Card>
  );
}

function StepTitle({
  n,
  title,
  done,
  stopped,
  children,
}: {
  n: string;
  title: string;
  done: boolean;
  stopped?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
          done && "border-evidence bg-evidence text-white",
          stopped && "border-destructive bg-destructive text-white",
        )}
      >
        {done ? (
          <CheckCircle2Icon className="size-4" />
        ) : stopped ? (
          <CircleSlashIcon className="size-4" />
        ) : (
          n
        )}
      </span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function AnswerButtons({
  value,
  yes,
  no,
  onChange,
}: {
  value: OptInAnswer;
  yes: string;
  no: string;
  onChange: (v: OptInAnswer) => void;
}) {
  if (value === true)
    return (
      <>
        <Badge className="bg-evidence text-white">
          <CheckCircle2Icon data-icon="inline-start" /> {yes}
        </Badge>
        <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
          Withdraw
        </Button>
      </>
    );
  if (value === false)
    return (
      <>
        <Badge variant="secondary">{no}</Badge>
        <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
          Change my mind
        </Button>
      </>
    );
  return (
    <>
      <Button size="sm" onClick={() => onChange(true)}>
        {yes}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onChange(false)}>
        {no}
      </Button>
    </>
  );
}

const OUTCOME_LABEL: Record<ReturnType<typeof pairOutcome>, string> = {
  awaiting: "Waiting for both answers.",
  "no-show": "The interview didn't take place.",
  interview: "Both want to continue.",
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
          <p className="text-sm">
            Did the interview take place? <span className="text-destructive">*</span>
          </p>
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
              <p className="text-sm">
                {q.usefulness} <span className="text-destructive">*</span>
              </p>
              <Stars value={usefulness} onChange={setUsefulness} label={q.usefulness} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm">
                {q.accuracy} <span className="text-destructive">*</span>
              </p>
              <Stars value={accuracy} onChange={setAccuracy} label={q.accuracy} />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm">
                What happens next? <span className="text-destructive">*</span>
              </p>
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
                Only counted in totals. The other side is not told.
              </p>
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`improve-${side}`}>
            What should the event do differently next time? (optional)
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
