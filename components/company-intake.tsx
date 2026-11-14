"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  CircleDashedIcon,
  InfoIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  SendHorizonalIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SkillChip } from "@/components/skill-chip";
import { EVENT } from "@/lib/data";
import { getSkill, searchSkills, skillLabel } from "@/lib/esco";
import {
  draftToNeed,
  EMPTY_DRAFT,
  ENGAGEMENTS,
  LANGUAGES,
  missingFields,
  MODES,
  quickReplyHint,
  type ChatMessage,
  type IntakeTurn,
  type NeedDraft,
  type Topic,
} from "@/lib/intake";
import { matchesForNeed, poolCoverage } from "@/lib/match";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

type Msg = ChatMessage & { added?: string[]; quickReplies?: string[]; source?: IntakeTurn["source"] };

const GREETING: Msg = {
  role: "assistant",
  content: `Hi! The event is ${EVENT.weeksAway} weeks away. Who would you like to meet there? Describe it in your own words. “We need a dev” is a perfectly good start.`,
  quickReplies: ["We need a dev", "Someone to sort out our data", "A nurse for home care"],
};

export function CompanyIntake() {
  const { talent, addNeed } = useDemo();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const [draft, setDraft] = useState<NeedDraft>(EMPTY_DRAFT);
  const [asked, setAsked] = useState<Topic[]>([]);
  const [source, setSource] = useState<IntakeTurn["source"] | null>(null);
  const [company, setCompany] = useState("Your company (demo)");
  const [reviewed, setReviewed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const missing = missingFields(draft);
  const need = useMemo(() => draftToNeed(draft, company), [draft, company]);
  const relevant = useMemo(
    () => (need.must.length ? matchesForNeed(need, talent).filter((m) => m.suggested).length : 0),
    [need, talent],
  );
  const evidenced = useMemo(() => poolCoverage(draft.must, talent), [draft.must, talent]);
  const finnishSpeakers = talent.filter((t) =>
    t.languages.some((l) => l.lang === "Finnish" && l.level !== "Learning"),
  ).length;

  // Scroll only the message list. scrollIntoView() would also scroll the page itself,
  // making the whole layout jump each time a reply arrives.
  const scrollDown = () =>
    requestAnimationFrame(() => {
      const el = threadRef.current;
      el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });

  // Any edit after approval re-opens the card for review.
  const edit = (patch: Partial<NeedDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setReviewed(false);
    setSubmitted(false);
  };

  const send = async (text: string, retry = false) => {
    const t = text.trim();
    if (!t || pending) return;
    setError(null);
    if (!retry) {
      setInput("");
      setMessages((m) => [...m, { role: "user", content: t }]);
    }
    // On retry the user's message is already the last one in the thread.
    const history: ChatMessage[] = [
      ...messages.map(({ role, content }) => ({ role, content })),
      ...(retry ? [] : [{ role: "user" as const, content: t }]),
    ];
    scrollDown();
    if (!navigator.onLine) {
      setError("You're offline. The assistant needs an internet connection; your message is kept.");
      return;
    }
    setPending(true);

    let turn: IntakeTurn;
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, draft, asked }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<IntakeTurn> & { error?: string };
      if (!res.ok || !data.reply || !data.draft)
        throw new Error(data.error ?? "No answer from the assistant.");
      turn = data as IntakeTurn;
    } catch (e) {
      // No offline fallback by design: keep the user's message and offer a retry.
      setError(
        e instanceof TypeError
          ? "Couldn't reach the assistant. Check your internet connection and try again."
          : e instanceof Error
            ? e.message
            : "Something went wrong. Try again.",
      );
      setPending(false);
      scrollDown();
      return;
    }

    const before = new Set([...draft.must, ...draft.nice]);
    const added = [...turn.draft.must, ...turn.draft.nice].filter((s) => !before.has(s));
    setDraft(turn.draft);
    setAsked(turn.asked);
    setSource(turn.source);
    setReviewed(false);
    setSubmitted(false);
    setMessages((m) => [
      ...m,
      { role: "assistant", content: turn.reply, added, quickReplies: turn.quickReplies, source: turn.source },
    ]);
    setPending(false);
    scrollDown();
  };

  const approve = () => {
    addNeed({ ...need, submittedWeeksBefore: EVENT.weeksAway });
    setSubmitted(true);
    toast.success("Need card approved and sent to the organiser", {
      description: "It now appears in the organiser dashboard.",
    });
  };

  const restart = () => {
    setError(null);
    setMessages([GREETING]);
    setDraft(EMPTY_DRAFT);
    setAsked([]);
    setSource(null);
    setReviewed(false);
    setSubmitted(false);
  };

  const lastMsg = messages[messages.length - 1];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
      {/* Chat */}
      <Card className="flex h-[640px] flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <BotIcon className="size-4 text-primary" /> Intake assistant
            <Badge variant="outline" className={cn("font-normal", !online && "text-destructive")}>
              <span
                className={cn("size-1.5 rounded-full", online ? "bg-evidence" : "bg-destructive")}
                aria-hidden
              />
              {online ? `Gemini${source ? "" : " · online"}` : "Offline"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Turns your words into ESCO skills using Gemini, so it needs an internet connection. It sees what
            you type and pool totals, never any candidate, and it doesn&apos;t pick candidates.
          </CardDescription>
          {messages.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={restart}
              className="col-start-2 row-span-2 row-start-1 self-start justify-self-end"
            >
              <RotateCcwIcon data-icon="inline-start" /> Start over
            </Button>
          )}
        </CardHeader>
        <CardContent
          ref={threadRef}
          className="flex-1 space-y-4 overflow-y-auto overscroll-contain py-4"
          aria-live="polite"
        >
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted",
                )}
              >
                <p className="whitespace-pre-line">{m.content}</p>
                {m.added && m.added.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.added.map((s) => (
                      <SkillChip key={s} id={s} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                <span className="sr-only">Assistant is typing</span>
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
          {error && !pending && (
            <div className="flex justify-start" role="alert">
              <div className="max-w-[85%] space-y-2 rounded-2xl rounded-bl-md border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm">
                <p className="flex items-start gap-1.5 text-destructive">
                  <WifiOffIcon className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
                {lastMsg.role === "user" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => send(lastMsg.content, true)}
                    disabled={!online}
                  >
                    <RotateCcwIcon data-icon="inline-start" /> Try again
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-2 border-t">
          {!online && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <WifiOffIcon className="size-3.5" /> You&apos;re offline. The assistant needs an internet
              connection; you can still edit the need card by hand.
            </p>
          )}
          {!pending &&
            online &&
            !error &&
            lastMsg.role === "assistant" &&
            lastMsg.quickReplies &&
            lastMsg.quickReplies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {lastMsg.quickReplies.map((q) => {
                  const hint = quickReplyHint(q, draft, talent);
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted"
                    >
                      <SparklesIcon className="size-3 text-primary" /> {q}
                      {hint && <span className="text-muted-foreground tabular-nums">· {hint}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={online ? "Type your answer…" : "Reconnect to chat with the assistant"}
              disabled={!online}
              aria-label="Message"
              className="min-h-10 resize-none"
              rows={2}
            />
            <Button
              type="submit"
              size="icon-lg"
              aria-label="Send"
              disabled={!input.trim() || pending || !online}
            >
              <SendHorizonalIcon />
            </Button>
          </form>
        </CardFooter>
      </Card>

      {/* Editable need card */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <PoolCount
          relevant={relevant}
          evidenced={evidenced}
          total={talent.length}
          hasMust={!!draft.must.length}
        />

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              Need card
              {submitted ? (
                <Badge className="bg-evidence text-white">Approved</Badge>
              ) : (
                <Badge variant="outline" className="font-normal">
                  <PencilIcon data-icon="inline-start" /> draft, editable
                </Badge>
              )}
            </CardDescription>
            <div className="grid gap-3 pt-1">
              <Field id="title" label="Role">
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(e) => edit({ title: e.target.value })}
                  placeholder="Filled in from the chat"
                />
              </Field>
              <Field id="company" label="Company">
                <Input
                  id="company"
                  value={company}
                  onChange={(e) => {
                    setCompany(e.target.value);
                    setReviewed(false);
                    setSubmitted(false);
                  }}
                />
              </Field>
              <Field id="summary" label="What they'll do">
                <Textarea
                  id="summary"
                  value={draft.summary}
                  onChange={(e) => edit({ summary: e.target.value })}
                  placeholder="Filled in from the chat"
                  rows={2}
                  className="min-h-14 resize-none"
                />
              </Field>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <SkillEditor draft={draft} onChange={edit} />

            <Separator />

            <ChoiceRow
              label="Working language"
              options={LANGUAGES}
              value={draft.language}
              onChange={(language) => edit({ language })}
            />
            {draft.language === "Finnish required" && (
              <p className="-mt-2 flex items-start gap-1.5 text-xs text-transfer">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                Only {finnishSpeakers} of {talent.length} people in the pool speak Finnish at working level.
                If the job can be learned in English first, “Finnish or English” keeps more people in.
              </p>
            )}
            <ChoiceRow
              label="Way of working"
              options={MODES}
              value={draft.mode}
              onChange={(mode) => edit({ mode })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="start" className="text-xs text-muted-foreground">
                Timing
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <Input
                  id="start"
                  value={draft.timing.start}
                  onChange={(e) => edit({ timing: { ...draft.timing, start: e.target.value } })}
                  placeholder="Start, e.g. February 2027"
                  className="h-8 w-44"
                />
                {ENGAGEMENTS.map((e) => (
                  <Button
                    key={e}
                    size="sm"
                    variant={draft.timing.engagement === e ? "default" : "outline"}
                    onClick={() => edit({ timing: { ...draft.timing, engagement: e } })}
                  >
                    {e}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            {submitted ? (
              <>
                <p className="flex items-center gap-1.5 text-sm text-evidence">
                  <ShieldCheckIcon className="size-4" /> You approved this card. The organiser decides which
                  suggested matches to approve.
                </p>
                <Button variant="outline" nativeButton={false} render={<Link href="/organiser" />}>
                  See it in the organiser dashboard <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </>
            ) : (
              <>
                {missing.length > 0 ? (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <CircleDashedIcon className="mt-0.5 size-3.5 shrink-0" />
                    Still open: {missing.join(", ")}. Answer in the chat or fill it in here.
                  </p>
                ) : (
                  <label className="flex items-start gap-2 text-xs leading-snug">
                    <Checkbox
                      checked={reviewed}
                      onCheckedChange={(c) => setReviewed(c === true)}
                      className="mt-0.5"
                    />
                    I&apos;ve reviewed this card. It describes the work and the skills it needs, not a
                    preferred kind of person.
                  </label>
                )}
                <Button onClick={approve} disabled={missing.length > 0 || !reviewed}>
                  <CheckIcon data-icon="inline-start" /> Approve and send to organiser
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5" role="group" aria-label={label}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Button
            key={o}
            size="sm"
            variant={value === o ? "default" : "outline"}
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {o}
          </Button>
        ))}
      </div>
    </div>
  );
}

function PoolCount({
  relevant,
  evidenced,
  total,
  hasMust,
}: {
  relevant: number;
  evidenced: number;
  total: number;
  hasMust: boolean;
}) {
  return (
    <Card size="sm" className="border-primary/20 bg-accent/40">
      <CardContent className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <UsersIcon className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          {hasMust ? (
            <>
              <p className="text-sm font-medium">
                <span
                  key={relevant}
                  className="inline-block animate-in text-2xl tabular-nums zoom-in-90 fade-in"
                >
                  {relevant}
                </span>{" "}
                relevant candidates already in the pool
              </p>
              <p className="text-xs leading-snug text-muted-foreground">
                {evidenced} of them show evidence for your must-haves in scenario answers or work samples, not
                keyword-matched CVs. Free to join doesn&apos;t mean low quality. You only see people after the
                organiser approves a match and both sides opt in.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">{total} people are registered for this event</p>
              <p className="text-xs text-muted-foreground">
                Once your card has must-have skills, you&apos;ll see how many are a relevant fit.
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SkillEditor({ draft, onChange }: { draft: NeedDraft; onChange: (p: Partial<NeedDraft>) => void }) {
  const [query, setQuery] = useState("");
  const all = [...draft.must, ...draft.nice];
  const hits = query
    ? searchSkills(query, { limit: 5, keywords: true }).filter((h) => !all.includes(h.item.id))
    : [];

  const setMust = (id: string, must: boolean) =>
    onChange({
      must: must ? [...draft.must, id] : draft.must.filter((s) => s !== id),
      nice: must ? draft.nice.filter((s) => s !== id) : [...draft.nice, id],
    });
  const remove = (id: string) =>
    onChange({ must: draft.must.filter((s) => s !== id), nice: draft.nice.filter((s) => s !== id) });
  const add = (id: string) => {
    onChange({ nice: [...draft.nice, id] });
    setQuery("");
  };

  const chip = (id: string, must: boolean) => {
    const skill = getSkill(id);
    return (
      <span
        key={id}
        className={cn(
          "flex h-7 items-center rounded-full border text-xs transition-colors",
          must ? "border-primary bg-primary text-primary-foreground" : "bg-card",
        )}
      >
        <button
          type="button"
          onClick={() => setMust(id, !must)}
          title={`${must ? "Make nice-to-have" : "Make must-have"} · ESCO: ${skill?.escoLabel ?? id}`}
          className={cn("flex h-full items-center gap-1 rounded-l-full pl-2.5", !must && "hover:bg-muted")}
        >
          {must && <CheckIcon className="size-3" />}
          {skillLabel(id)}
        </button>
        <button
          type="button"
          onClick={() => remove(id)}
          aria-label={`Remove ${skillLabel(id)}`}
          className="flex h-full items-center rounded-r-full pr-2 pl-1 opacity-60 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>Must-have (ESCO)</span>
          {draft.must.length > 3 && <span className="text-transfer">More than 3 shrinks the pool a lot</span>}
        </p>
        {draft.must.length ? (
          <div className="flex flex-wrap gap-1.5">{draft.must.map((s) => chip(s, true))}</div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
            Skills appear here as you chat. Tap one to toggle must-have.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Nice-to-have</p>
        {draft.nice.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{draft.nice.map((s) => chip(s, false))}</div>
        )}
        <div className="relative">
          <PlusIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && hits[0]) {
                e.preventDefault();
                add(hits[0].item.id);
              }
            }}
            placeholder="Add a skill (English, suomi, svenska)"
            aria-label="Add a skill"
            className="h-8 pl-8 text-xs"
          />
          {hits.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
              {hits.map((h) => (
                <li key={h.item.id}>
                  <button
                    type="button"
                    onClick={() => add(h.item.id)}
                    className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <span>{h.item.label}</span>
                    <span className="truncate text-muted-foreground">{h.item.escoLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Browser connectivity; assumed online during server rendering. */
function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
