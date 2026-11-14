"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BotIcon,
  MessageCircleIcon,
  RotateCcwIcon,
  SendHorizonalIcon,
  SparklesIcon,
  UsersIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CandidateProfile } from "@/components/candidate-profile";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { EVENT } from "@/lib/data";
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
import { matchesForNeed } from "@/lib/match";
import { useDemo } from "@/lib/store";
import { cn, isSubmitEnter } from "@/lib/utils";

type Msg = ChatMessage & {
  added?: string[];
  removed?: string[];
  rechecked?: boolean;
  quickReplies?: string[];
  source?: IntakeTurn["source"];
};

const COMPANY = "Your company (demo)";

const GREETING: Msg = {
  role: "assistant",
  content: `Hi, I'm TrueFit Assistant! The event is ${EVENT.weeksAway} weeks away. Who would you like to meet there? Describe it in your own words. “We need a dev” is a perfectly good start.`,
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

  const need = useMemo(() => draftToNeed(draft, COMPANY), [draft]);
  // Live: who fits the card right now. Ranked by skills only (lib/match.ts).
  const suitable = useMemo(
    () => (need.must.length ? matchesForNeed(need, talent).filter((m) => m.suggested) : []),
    [need, talent],
  );
  const byId = useMemo(() => new Map(talent.map((t) => [t.id, t])), [talent]);

  // No separate need card to approve: once the chat has a role and must-have skills, the
  // need is saved so the Candidates and Meetings pages can invite these people.
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
    setError(null);
    setMessages([GREETING]);
    setDraft(EMPTY_DRAFT);
    setAsked([]);
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
            Turns your answers into the need card. It only sees what you type and how many people are
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
                {m.rechecked && (
                  <p className="flex items-center gap-1 text-xs font-medium text-primary">
                    <RotateCcwIcon className="size-3" /> New role: card and people count rechecked
                  </p>
                )}
                <p className="whitespace-pre-line">{m.content}</p>
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
              ref={inputRef}
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
        <Button size="sm" onClick={openChat}>
          <MessageCircleIcon data-icon="inline-start" />
          {messages.length > 1 ? "Change in the chat" : "Chat with TrueFit Assistant"}
        </Button>
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
                Best skill match first. Names and contact details are fictional demo data; name, city and
                languages never change the skill match.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href="/company/candidates" />}
            >
              Invite on the Candidates page <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </div>
          <SkillLegend />
          <div className="grid gap-4 lg:grid-cols-2">
            {suitable.map((m) => {
              const t = byId.get(m.talentId);
              return t ? <CandidateProfile key={t.id} t={t} m={m} /> : null;
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
