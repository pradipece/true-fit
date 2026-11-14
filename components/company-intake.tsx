"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  CircleDashedIcon,
  InfoIcon,
  LandmarkIcon,
  Loader2Icon,
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
  DEFAULT_STARTERS,
  draftToNeed,
  EMPTY_DRAFT,
  ENGAGEMENTS,
  FREE_TEXT_MAX,
  languageCount,
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
import { asksNativeSpeaker, languageRule, modeKind, onlyFinnish, openToMode } from "@/lib/need-terms";
import { useDemo } from "@/lib/store";
import { cn, isSubmitEnter } from "@/lib/utils";

type Msg = ChatMessage & { added?: string[]; quickReplies?: string[]; source?: IntakeTurn["source"] };

const GREETING: Msg = {
  role: "assistant",
  content: `Hi! The event is ${EVENT.weeksAway} weeks away. Who would you like to meet there? Describe it in your own words. “We need a dev” is a perfectly good start.`,
  quickReplies: DEFAULT_STARTERS,
};

export function CompanyIntake() {
  const { talent, addNeed } = useDemo();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  // Opening suggestions tailored by Gemini to who is registered; fixed ones until they arrive.
  const [starters, setStarters] = useState<string[]>(DEFAULT_STARTERS);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/intake/starters", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { starters?: unknown } | null) => {
        if (Array.isArray(d?.starters) && d.starters.length) setStarters(d.starters as string[]);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, []);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  const [draft, setDraft] = useState<NeedDraft>(EMPTY_DRAFT);
  const [asked, setAsked] = useState<Topic[]>([]);
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
  const speakers = draft.language ? languageCount(draft.language, talent) : 0;
  const knownLanguage = !!languageRule(draft.language);
  const kind = modeKind(draft.mode);
  const openToThisMode = talent.filter((t) => openToMode(draft.mode, t)).length;

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
    setReviewed(false);
    setSubmitted(false);
  };

  const lastMsg = messages[messages.length - 1];
  const replies = messages.length === 1 ? starters : (lastMsg.quickReplies ?? []);

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
              {online ? "AI · online" : "Offline"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Answer a few questions in your own words and the assistant turns them into a list of skills. It
            needs an internet connection. It only sees what you type and how many people are registered, never
            any candidate, and it never picks candidates.
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
          {!pending && online && !error && lastMsg.role === "assistant" && replies.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Suggested answers">
              <span className="mr-0.5 text-xs text-muted-foreground">Suggested answers:</span>
              {replies.map((q) => {
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
                if (isSubmitEnter(e)) {
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

            <ChoiceOrText
              id="language"
              label="Working language"
              options={LANGUAGES}
              value={draft.language}
              onChange={(language) => edit({ language })}
              placeholder="Or write your own, e.g. Swedish or English"
            />
            {draft.language && (
              <div className="-mt-2 space-y-1">
                {asksNativeSpeaker(draft.language) ? (
                  <FieldNote tone="warn">
                    “Native speaker” screens people out by where they grew up, not by what they can do. Ask
                    for a working level instead, e.g. “Fluent Finnish”.
                  </FieldNote>
                ) : onlyFinnish(draft.language) ? (
                  <FieldNote tone="warn">
                    Only {speakers} of {talent.length} people at this event can work in this language. If the
                    job can be learned in English first, “Finnish or English” keeps more people in.
                  </FieldNote>
                ) : knownLanguage ? (
                  <FieldNote>
                    {speakers} of {talent.length} people at this event can work in this language.
                  </FieldNote>
                ) : (
                  <FieldNote>No language named, so nobody is left out because of language.</FieldNote>
                )}
              </div>
            )}
            <ChoiceOrText
              id="mode"
              label="Way of working"
              options={MODES}
              value={draft.mode}
              onChange={(mode) => edit({ mode })}
              placeholder="Or write your own, e.g. On-site 3 days a week"
            />
            {draft.mode && (
              <div className="-mt-2">
                <FieldNote>
                  {kind
                    ? `${openToThisMode} of ${talent.length} people are open to ${kind.toLowerCase()} work.`
                    : "Couldn't tell if this is on-site, hybrid or remote, so nobody is left out because of it."}
                </FieldNote>
              </div>
            )}
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
                  className="h-8 w-full sm:w-60"
                />
              </div>
            </div>
            <ChoiceOrText
              id="engagement"
              label="Contract"
              options={ENGAGEMENTS}
              value={draft.timing.engagement}
              onChange={(engagement) => edit({ timing: { ...draft.timing, engagement } })}
              placeholder="Or write your own, e.g. 6-month project"
            />
          </CardContent>

          <CardFooter className="flex-col items-stretch gap-3">
            {submitted ? (
              <>
                <p className="flex items-center gap-1.5 text-sm text-evidence">
                  <ShieldCheckIcon className="size-4" /> You approved this card. The organiser decides which
                  suggested matches to approve.
                </p>
                <Button variant="outline" nativeButton={false} render={<Link href="/meetings/company" />}>
                  Go to your meetings <ArrowRightIcon data-icon="inline-end" />
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

/** Preset buttons plus a free-text box: pick a common answer or write your own. */
function ChoiceOrText({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const custom = options.includes(value) ? "" : value;
  return (
    <div className="space-y-1.5" role="group" aria-labelledby={`${id}-label`}>
      <p id={`${id}-label`} className="text-xs text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Button
            key={o}
            size="sm"
            variant={value === o ? "default" : "outline"}
            aria-pressed={value === o}
            onClick={() => onChange(value === o ? "" : o)}
          >
            {o}
          </Button>
        ))}
      </div>
      <Input
        id={id}
        value={custom}
        onChange={(e) => onChange(e.target.value)}
        maxLength={FREE_TEXT_MAX}
        placeholder={placeholder}
        aria-label={`${label}, in your own words`}
        className={cn("h-8 text-xs", custom && "border-primary/50")}
      />
    </div>
  );
}

function FieldNote({ tone, children }: { tone?: "warn"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs",
        tone === "warn" ? "text-transfer" : "text-muted-foreground",
      )}
    >
      <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
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
                people at this event already fit
              </p>
              <p className="text-xs leading-snug text-muted-foreground">
                {evidenced} of them have shown your must-have skills in their own answers or work samples, not
                just listed them on a CV. Free to join doesn&apos;t mean low quality. You only see people
                after the organiser approves a match and both sides opt in.
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
  const esco = useEscoSkillSearch(query);

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
          title={`${must ? "Make nice-to-have" : "Make must-have"} · EU skill name: ${skill?.escoLabel ?? id}`}
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
          <span>Must-have skills</span>
          {draft.must.length > 3 && <span className="text-transfer">More than 3 rules out many people</span>}
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
              if (isSubmitEnter(e) && hits[0]) {
                e.preventDefault();
                add(hits[0].item.id);
              }
            }}
            placeholder="Add a skill (English, suomi, svenska)"
            aria-label="Add a skill"
            className="h-8 pl-8 text-xs"
          />
          {query.trim().length >= 2 && (hits.length > 0 || esco.state !== "idle") && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover text-xs shadow-md">
              {hits.length > 0 && (
                <ul>
                  {hits.map((h) => (
                    <li key={h.item.id}>
                      <button
                        type="button"
                        onClick={() => add(h.item.id)}
                        className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted"
                      >
                        <span>{h.item.label}</span>
                        <span className="truncate text-muted-foreground">{h.item.escoLabel}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex items-center gap-1.5 border-t bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
                <LandmarkIcon className="size-3" /> More from the EU skills list
                {esco.state === "loading" && <Loader2Icon className="size-3 animate-spin" />}
              </p>
              {esco.state === "error" && (
                <p className="px-3 py-1.5 text-muted-foreground">
                  The EU skills list can&apos;t be reached right now.
                </p>
              )}
              {esco.state === "done" && esco.hits.length === 0 && (
                <p className="px-3 py-1.5 text-muted-foreground">No matching skills in the EU list.</p>
              )}
              {esco.state === "done" && (
                <ul>
                  {esco.hits.map((h) => {
                    const id = h.subset?.id;
                    const have = !!id && all.includes(id);
                    return (
                      <li key={h.uri}>
                        <button
                          type="button"
                          disabled={!id || have}
                          onClick={() => id && add(id)}
                          title={
                            !id
                              ? "Not in this event's skill set yet, so it can't be matched"
                              : h.subset?.via === "keyword"
                                ? `Close match: adds “${skillLabel(id)}”`
                                : undefined
                          }
                          className="flex w-full items-baseline justify-between gap-2 px-3 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="first-letter:uppercase">{h.title}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {!id
                              ? "not in this event's skill set yet"
                              : have
                                ? "on the card"
                                : `→ ${skillLabel(id)}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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

type EscoSkillHit = { uri: string; title: string; subset?: { id: string; via: "uri" | "keyword" } };
type EscoSearch = { state: "idle" | "loading" | "done" | "error"; hits: EscoSkillHit[] };

/** Live ESCO skill search, debounced, for skills beyond the cached list. */
function useEscoSkillSearch(query: string): EscoSearch {
  const [result, setResult] = useState<EscoSearch & { q: string }>({ q: "", state: "idle", hits: [] });
  const q = query.trim();
  useEffect(() => {
    if (q.length < 3) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setResult({ q, state: "loading", hits: [] });
      try {
        const res = await fetch(`/api/esco/search?type=skill&q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { hits?: EscoSkillHit[] };
        if (!res.ok || !data.hits) throw new Error();
        setResult({ q, state: "done", hits: data.hits });
      } catch {
        if (!ctrl.signal.aborted) setResult({ q, state: "error", hits: [] });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);
  // Results for an older query, or a query too short to search, count as idle.
  return q.length >= 3 && result.q === q ? result : { state: q.length >= 3 ? "loading" : "idle", hits: [] };
}
