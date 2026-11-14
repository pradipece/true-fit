"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRightIcon,
  AudioLinesIcon,
  BotIcon,
  CheckIcon,
  HandIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  PencilLineIcon,
  MessageCircleIcon,
  RotateCcwIcon,
  SendHorizonalIcon,
  SparklesIcon,
  Undo2Icon,
  UsersIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AiFitBadge, RankToggle, useAiRanking } from "@/components/ai-rank";
import { CandidateProfile } from "@/components/candidate-profile";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { useLiveIntake } from "@/components/use-live-intake";
import { VoiceInput } from "@/components/voice-input";
import { useSession } from "@/components/session";
import { COMPANIES, EVENT, OWN_COMPANY } from "@/lib/data";
import {
  DEFAULT_STARTERS,
  draftToNeed,
  EMPTY_DRAFT,
  quickReplyHint,
  type ChatMessage,
  type IntakeTurn,
  type NeedDraft,
  type Topic,
} from "@/lib/intake";
import { cardFromToolArgs, liveToolResult } from "@/lib/intake-live";
import { explainMatch, matchesForNeed, pairKey } from "@/lib/match";
import { companyOf } from "@/lib/schedule";
import { companiesFor } from "@/lib/explore";
import type { Need, Talent } from "@/lib/types";
import { COMPANY_LABEL, stageOf, type PairStage } from "@/lib/pipeline";
import { useDemo } from "@/lib/store";
import { cn, isSubmitEnter } from "@/lib/utils";

type Msg = ChatMessage & {
  added?: string[];
  removed?: string[];
  rechecked?: boolean;
  quickReplies?: string[];
  source?: IntakeTurn["source"];
  /** A transcript bubble from the live voice conversation that is still being spoken. */
  live?: boolean;
  /** "card": a note that the live conversation updated the need card (not sent to the model). */
  kind?: "card";
};

const GREETING: Msg = {
  role: "assistant",
  content: `Hi, I'm TrueFit Assistant! Who would you like to hire? Describe it in your own words. “We need a dev” is a perfectly good start.`,
  quickReplies: DEFAULT_STARTERS,
};

export function CompanyIntake() {
  const { talent, needs, addNeed, decisions, optIns, slots, screening, offers, setOptIn } = useDemo();
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
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const online = useOnline();
  const [draft, setDraft] = useState<NeedDraft>(EMPTY_DRAFT);
  const [asked, setAsked] = useState<Topic[]>([]);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const live = useLiveIntake({
    onTranscript: (role, text) =>
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last?.live && last.role === role)
          return [...m.slice(0, -1), { ...last, content: last.content + text }];
        return [...m.map((x) => (x.live ? closeBubble(x) : x)), { role, content: text, live: true }];
      }),
    onTurnEnd: () => setMessages((m) => m.map((x) => (x.live ? closeBubble(x) : x))),
    onCard: (args) => {
      const next = cardFromToolArgs(args);
      const prev = draftRef.current;
      const before = new Set([...prev.must, ...prev.nice]);
      const after = new Set([...next.must, ...next.nice]);
      draftRef.current = next;
      setDraft(next);
      setMessages((m) => [
        ...m.map((x) => (x.live ? closeBubble(x) : x)),
        {
          role: "assistant",
          kind: "card",
          content: next.title ? `Need card updated: ${next.title}` : "Need card updated",
          added: [...after].filter((x) => !before.has(x)),
          removed: [...before].filter((x) => !after.has(x)),
        },
      ]);
      // Counts only, never who the people are.
      return liveToolResult(next, talent);
    },
  });
  const isLive = live.state === "live" || live.state === "connecting";
  // The chat lives in a popup opened from the round button in the bottom-right corner.
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatOpenRef = useRef(chatOpen);
  useEffect(() => {
    chatOpenRef.current = chatOpen;
  }, [chatOpen]);
  const openChat = () => {
    setChatOpen(true);
    setUnread(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };
  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setChatOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen]);

  // The need card belongs to the signed-in company (lib/auth); the server refuses any other.
  const { session } = useSession();
  const owner = useMemo(() => {
    const id = session?.role === "company" ? session.id : OWN_COMPANY.id;
    const c = COMPANIES.find((x) => x.id === id);
    return {
      id,
      name: c?.name ?? (id === OWN_COMPANY.id ? OWN_COMPANY.name : (session?.name ?? OWN_COMPANY.name)),
      blurb: c?.blurb,
    };
  }, [session]);
  const need = useMemo(() => draftToNeed(draft, owner.name, owner), [draft, owner]);
  // Live: who fits the card right now. Ranked by skills only (lib/match.ts).
  const suitable = useMemo(
    () => (need.must.length ? matchesForNeed(need, talent).filter((m) => m.suggested) : []),
    [need, talent],
  );
  const byId = useMemo(() => new Map(talent.map((t) => [t.id, t])), [talent]);
  // Every role at the event with the current draft in place of its saved copy, so each
  // candidate shows how well they match this company overall and where it ranks for them.
  const eventNeeds = useMemo(() => [need, ...needs.filter((n) => n.id !== need.id)], [needs, need]);
  // The company's other saved roles, so each candidate also shows their match for those.
  const otherNeeds = useMemo(
    () => needs.filter((n) => companyOf(n) === companyOf(need) && n.id !== need.id),
    [needs, need],
  );
  const ranking = useAiRanking(need, suitable, byId);

  // No separate need card to approve: once the chat has a role and must-have skills, the
  // need is saved so the organiser can introduce these people (and the company can ask it to).
  useEffect(() => {
    if (need.title !== "New role" && need.must.length)
      addNeed({ ...need, submittedWeeksBefore: EVENT.weeksAway });
  }, [need, addNeed]);

  // Scroll only the message list. scrollIntoView() would also scroll the page itself,
  // making the whole layout jump each time a reply arrives.
  const scrollDown = () =>
    requestAnimationFrame(() => {
      const el = threadRef.current;
      el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });

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
      ...messages.filter((m) => !m.kind).map(({ role, content }) => ({ role, content })),
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
    const after = new Set([...turn.draft.must, ...turn.draft.nice]);
    const removed = [...before].filter((s) => !after.has(s));
    setDraft(turn.draft);
    setAsked(turn.asked);
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: turn.reply,
        added,
        removed,
        rechecked: !!turn.recheck,
        quickReplies: turn.quickReplies,
        source: turn.source,
      },
    ]);
    if (!chatOpenRef.current) setUnread(true);
    setPending(false);
    scrollDown();
  };

  const restart = () => {
    if (isLive) live.stop();
    setError(null);
    setMessages([GREETING]);
    setDraft(EMPTY_DRAFT);
    setAsked([]);
  };

  const startLive = () => {
    openChat();
    void live.start(draftRef.current);
  };

  const lastMsg = messages[messages.length - 1];
  const replies = messages.length === 1 ? starters : (lastMsg.quickReplies ?? []);

  return (
    <div className="space-y-6">
      {/* Chat popup, opened from the button in the bottom-right corner */}
      <Card
        role="dialog"
        aria-label="TrueFit Assistant"
        aria-hidden={!chatOpen}
        className={cn(
          "fixed right-4 bottom-22 z-50 flex h-[min(620px,calc(100dvh-8rem))] w-[calc(100vw-2rem)] flex-col shadow-2xl sm:w-[420px]",
          "origin-bottom-right transition-[opacity,scale] duration-200",
          chatOpen ? "scale-100 opacity-100" : "pointer-events-none invisible scale-95 opacity-0",
        )}
      >
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <BotIcon className="size-4 text-primary" /> TrueFit Assistant
            <Badge variant="outline" className={cn("font-normal", !online && "text-destructive")}>
              <span
                className={cn("size-1.5 rounded-full", online ? "bg-evidence" : "bg-destructive")}
                aria-hidden
              />
              {online ? "AI · online" : "Offline"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Turns your answers into the need card. It only sees what you type or say and how many people are
            registered, never any candidate.
          </CardDescription>
          <div className="col-start-2 row-span-2 row-start-1 flex items-center gap-1 self-start justify-self-end">
            {messages.length > 1 && (
              <Button variant="ghost" size="sm" onClick={restart}>
                <RotateCcwIcon data-icon="inline-start" /> Start over
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Close chat" onClick={() => setChatOpen(false)}>
              <XIcon />
            </Button>
          </div>
        </CardHeader>
        <CardContent
          ref={threadRef}
          className="flex-1 space-y-4 overflow-y-auto overscroll-contain py-4"
          aria-live="polite"
        >
          {messages.map((m, i) =>
            m.kind === "card" ? (
              <div
                key={i}
                className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground"
              >
                <PencilLineIcon className="size-3 text-primary" /> {m.content}
                {m.added?.map((s) => (
                  <SkillChip key={s} id={s} />
                ))}
                {m.removed?.map((s) => (
                  <SkillChip key={s} id={s} className="line-through opacity-60" />
                ))}
              </div>
            ) : (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md bg-muted",
                  )}
                >
                  {m.live && (
                    <span className="flex items-center gap-1 text-[10px] font-medium tracking-wide uppercase opacity-70">
                      <AudioLinesIcon className="size-3 animate-pulse" /> speaking
                    </span>
                  )}
                  {m.rechecked && (
                    <p className="flex items-center gap-1 text-xs font-medium text-primary">
                      <RotateCcwIcon className="size-3" /> New role: card and people count rechecked
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.content.trim() || "…"}</p>
                  {m.added && m.added.length > 0 && (
                    <div className="flex flex-wrap gap-1" aria-label="Skills added">
                      {m.added.map((s) => (
                        <SkillChip key={s} id={s} />
                      ))}
                    </div>
                  )}
                  {m.removed && m.removed.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1" aria-label="Skills removed">
                      <span className="text-xs text-muted-foreground">Removed:</span>
                      {m.removed.map((s) => (
                        <SkillChip key={s} id={s} className="line-through opacity-60" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
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
          {!isLive && !pending && online && !error && lastMsg.role === "assistant" && replies.length > 0 && (
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
          {isLive ? (
            <div
              className="flex items-center gap-3 rounded-xl border border-primary/30 bg-accent/40 px-3 py-2"
              aria-live="polite"
            >
              <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                {live.state === "live" && !live.muted && (
                  <span
                    className="absolute inset-0 rounded-full bg-primary/40 transition-transform duration-75"
                    style={{ transform: `scale(${1 + Math.min(live.level * 3, 0.8)})` }}
                    aria-hidden
                  />
                )}
                <AudioLinesIcon className="relative size-4" />
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium">
                  {live.state === "connecting"
                    ? "Connecting…"
                    : live.speaking
                      ? "Assistant is speaking"
                      : live.muted
                        ? "Microphone muted"
                        : "Listening, just talk"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  Interrupt any time. The card and candidates update as you talk.
                </span>
              </span>
              <Button
                size="icon"
                variant="outline"
                onClick={live.toggleMute}
                disabled={live.state !== "live"}
                aria-label={live.muted ? "Unmute microphone" : "Mute microphone"}
                aria-pressed={live.muted}
              >
                {live.muted ? <MicOffIcon /> : <MicIcon />}
              </Button>
              <Button
                size="icon"
                variant="destructive"
                onClick={live.stop}
                aria-label="End live conversation"
              >
                <PhoneOffIcon />
              </Button>
            </div>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (isSubmitEnter(e)) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={online ? "Type or speak your answer…" : "Reconnect to chat with the assistant"}
                disabled={!online}
                aria-label="Message"
                className="min-h-10 resize-none"
                rows={2}
              />
              <VoiceInput
                disabled={!online || pending}
                onError={setVoiceError}
                onTranscript={(text) => {
                  setVoiceError(null);
                  // Fill the box, don't send: the user checks what Gemini heard first.
                  setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
                  requestAnimationFrame(() => {
                    const el = inputRef.current;
                    if (!el) return;
                    el.focus();
                    el.setSelectionRange(el.value.length, el.value.length);
                  });
                }}
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
          )}
          {!isLive && (
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={startLive}
              disabled={!online || pending}
            >
              <AudioLinesIcon data-icon="inline-start" /> Talk live with the assistant instead
            </Button>
          )}
          {live.error && (
            <p className="text-xs text-destructive" role="alert">
              {live.error}
            </p>
          )}
          {voiceError && (
            <p className="text-xs text-destructive" role="alert">
              {voiceError}
            </p>
          )}
        </CardFooter>
      </Card>

      <Button
        size="icon-lg"
        onClick={() => (chatOpen ? setChatOpen(false) : openChat())}
        aria-label={chatOpen ? "Close TrueFit Assistant" : "Open TrueFit Assistant"}
        aria-expanded={chatOpen}
        className="fixed right-4 bottom-4 z-50 size-14 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-6"
      >
        {chatOpen ? <XIcon /> : <MessageCircleIcon />}
        {!chatOpen && (unread || messages.length === 1) && (
          <span className="absolute top-0.5 right-0.5 flex size-3.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-evidence opacity-75" />
            <span className="relative inline-flex size-3.5 rounded-full border-2 border-background bg-evidence" />
          </span>
        )}
      </Button>

      {/* What the assistant understood, in one line, and a way into the chat */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        {draft.must.length ? (
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm">
              <span className="font-medium">{draft.title || "New role"}</span>
              <span className="text-muted-foreground tabular-nums">
                {" "}
                · {suitable.length} of {talent.length} people at this event fit
              </span>
            </p>
            <div className="flex flex-wrap gap-1">
              {draft.must.map((s) => (
                <SkillChip key={s} id={s} must />
              ))}
              {draft.nice.map((s) => (
                <SkillChip key={s} id={s} />
              ))}
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm">
            <BotIcon className="size-4 shrink-0 text-primary" />
            Tell TrueFit Assistant who you need. “We need a dev” is a fine start.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={startLive} disabled={!online || isLive}>
            <AudioLinesIcon data-icon="inline-start" /> {isLive ? "Live now" : "Talk live"}
          </Button>
          <Button size="sm" onClick={openChat}>
            <MessageCircleIcon data-icon="inline-start" />
            {messages.length > 1 ? "Change in the chat" : "Chat with TrueFit Assistant"}
          </Button>
        </div>
      </div>

      {/* Suitable candidates, live */}
      {suitable.length > 0 ? (
        <section className="space-y-4" aria-labelledby="suitable-candidates">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="suitable-candidates" className="flex items-center gap-2 text-lg font-semibold">
                <UsersIcon className="size-5 text-primary" /> Suitable candidates
              </h2>
              <p className="text-sm text-muted-foreground">
                Best skill match first. The event organiser makes the introductions: ask it to introduce
                anyone you&apos;d like to meet. Names and contact details are fictional demo data; name, city
                and languages never change the skill match.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/meetings/company" />}
            >
              Your introductions <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
          <RankToggle ranking={ranking} />
          <SkillLegend />
          <div className="grid gap-4 lg:grid-cols-2">
            {ranking.ordered.map((m) => {
              const t = byId.get(m.talentId);
              if (!t) return null;
              const key = pairKey(need.id, t.id);
              return (
                <CandidateProfile
                  key={t.id}
                  t={t}
                  m={m}
                  role={need.title}
                  company={companyFit(eventNeeds, t, companyOf(need))}
                  otherRoles={otherNeeds.map((n) => {
                    const o = explainMatch(n, t);
                    return { id: n.id, title: n.title, score: o.score, suggested: o.suggested };
                  })}
                  note={<AiFitBadge fit={ranking.fitOf(t.id)} />}
                  footer={
                    <IntroRequest
                      pair={key}
                      stage={stageOf(key, { decisions, optIns, slots, screening, offers })}
                      asked={optIns[key]?.company === true}
                      onAsk={(v) => setOptIn(key, "company", v)}
                    />
                  }
                />
              );
            })}
          </div>
        </section>
      ) : (
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <UsersIcon className="mx-auto size-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              {draft.must.length
                ? "Nobody fits these must-have skills yet. Ask the assistant to move a rare skill to nice-to-have."
                : "Suitable candidates appear here, with their contact details, as soon as the assistant knows which skills you need."}
            </p>
            <Button variant="outline" onClick={openChat}>
              <MessageCircleIcon data-icon="inline-start" /> Chat with TrueFit Assistant
            </Button>
          </CardContent>
        </Card>
      )}
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

/** Close a live transcript bubble once its turn is over. */
const closeBubble = (m: Msg): Msg => ({ ...m, live: false, content: m.content.trim() });

/**
 * The company can't invite directly: it asks the organiser (the event's broker) for an
 * introduction, which counts as the company's yes. The organiser still decides, with a reason.
 */
export function IntroRequest({
  pair,
  stage: p,
  asked,
  onAsk,
}: {
  pair: string;
  stage: PairStage;
  asked: boolean;
  onAsk: (v: true | undefined) => void;
}) {
  // Passed the Espoo interview: the profile is the company's to act on.
  if (p.step >= 3)
    return (
      <Button
        size="sm"
        className="ml-auto"
        variant={p.waiting === "company" || p.waiting === "either" ? "default" : "outline"}
        nativeButton={false}
        render={<Link href={`/meetings/company?pair=${encodeURIComponent(pair)}`} />}
      >
        {COMPANY_LABEL[p.stage]} <ArrowRightIcon data-icon="inline-end" />
      </Button>
    );
  if (p.stopped)
    return <span className="ml-auto text-xs text-muted-foreground">Espoo didn&apos;t take this forward</span>;
  if (p.step === 2)
    return (
      <Badge
        variant="outline"
        className="ml-auto border-primary/30 bg-accent font-normal text-accent-foreground"
      >
        <CheckIcon data-icon="inline-start" /> Espoo is interviewing this candidate
      </Badge>
    );
  return asked ? (
    <>
      <Badge variant="outline" className="border-primary/30 bg-accent font-normal text-accent-foreground">
        <CheckIcon data-icon="inline-start" /> Asked the organiser
      </Badge>
      <Button
        size="sm"
        variant="ghost"
        className="ml-auto"
        onClick={() => {
          onAsk(undefined);
          toast("Request withdrawn");
        }}
      >
        <Undo2Icon data-icon="inline-start" /> Withdraw
      </Button>
    </>
  ) : (
    <Button
      size="sm"
      className="ml-auto"
      onClick={() => {
        onAsk(true);
        toast.success("Introduction requested", {
          description:
            "Espoo sees your request. If it fits, Espoo interviews the candidate and sends you their profile when they pass.",
        });
      }}
    >
      <HandIcon data-icon="inline-start" /> Ask the organiser to introduce
    </Button>
  );
}

/** This company's match for one person (its best role) and its rank among all companies. */
export function companyFit(needs: Need[], t: Talent, companyId: string) {
  const ranked = companiesFor(needs, t);
  const i = ranked.findIndex((c) => c.companyId === companyId);
  if (i < 0) return undefined;
  return {
    name: ranked[i].best.need.company,
    score: ranked[i].best.m.score,
    rank: i + 1,
    total: ranked.length,
  };
}
