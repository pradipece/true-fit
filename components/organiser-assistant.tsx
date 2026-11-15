"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  LandmarkIcon,
  MessageCircleIcon,
  RotateCcwIcon,
  SendHorizonalIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSISTANT_LINKS,
  eventSnapshot,
  rulesReply,
  STARTERS,
  type AssistantReply,
  type LinkId,
} from "@/lib/organiser-assistant";
import { useDemo } from "@/lib/store";
import { cn, isSubmitEnter } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; links?: LinkId[]; source?: "ai" | "rules" };

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hei! I'm the Espoo Esbo assistant. I can tell you how the event is going and where to look next: what to review, which needs are short of people, open requests, fairness and the schedule. I only see totals, never individual candidates, and I never decide for you. What can I do for you?",
};

/**
 * Espoo Esbo assistant: a chat popup on the organiser pages. Each question goes to
 * /api/organiser/assistant with an aggregate snapshot of the event (counts only).
 * Without a connection it answers from the same snapshot with rules, in the browser.
 */
export function OrganiserAssistant() {
  const state = useDemo();
  const snapshot = useMemo(
    () => eventSnapshot(state),
    [state.needs, state.talent, state.decisions, state.optIns, state.slots, state.feedback], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [suggestions, setSuggestions] = useState<string[]>(STARTERS);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    const el = threadRef.current;
    requestAnimationFrame(() => el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
  }, [messages, busy]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    let reply: AssistantReply & { source: "ai" | "rules" };
    try {
      if (!navigator.onLine) throw new Error("offline");
      const res = await fetch("/api/organiser/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot,
          // The greeting is UI text, not part of the conversation.
          messages: next.slice(1).map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reply = await res.json();
    } catch {
      reply = { ...rulesReply(q, snapshot), source: "rules" };
    }
    setMessages((m) => [
      ...m,
      { role: "assistant", content: reply.reply, links: reply.links, source: reply.source },
    ]);
    setSuggestions(
      reply.suggestions.length ? reply.suggestions : STARTERS.filter((s) => s !== q).slice(0, 3),
    );
    setBusy(false);
  };

  const restart = () => {
    setMessages([GREETING]);
    setSuggestions(STARTERS);
    setInput("");
  };

  return (
    <>
      <Card
        role="dialog"
        aria-label="Espoo Esbo assistant"
        aria-hidden={!open}
        className={cn(
          "fixed right-4 bottom-22 z-50 flex h-[min(620px,calc(100dvh-8rem))] w-[calc(100vw-2rem)] flex-col shadow-2xl sm:w-[420px]",
          "origin-bottom-right transition-[opacity,scale] duration-200",
          open ? "scale-100 opacity-100" : "pointer-events-none invisible scale-95 opacity-0",
        )}
      >
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <LandmarkIcon className="size-4 text-primary" /> Espoo Esbo assistant
          </CardTitle>
          <CardDescription>
            Answers from event totals only: counts per company need, introductions, schedule and fairness. It
            never sees a candidate and never decides.
          </CardDescription>
          <div className="col-start-2 row-span-2 row-start-1 flex items-center gap-1 self-start justify-self-end">
            {messages.length > 1 && (
              <Button variant="ghost" size="sm" onClick={restart}>
                <RotateCcwIcon data-icon="inline-start" /> Start over
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Close chat" onClick={() => setOpen(false)}>
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
                  "max-w-[85%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted",
                )}
              >
                <p className="whitespace-pre-line">{m.content}</p>
                {!!m.links?.length && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.links.map((l) => (
                      <Button
                        key={l}
                        size="xs"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={ASSISTANT_LINKS[l].href} />}
                      >
                        {ASSISTANT_LINKS[l].label} <ArrowRightIcon data-icon="inline-end" />
                      </Button>
                    ))}
                  </div>
                )}
                {m.source && (
                  <p className="text-[11px] text-muted-foreground">
                    {m.source === "ai"
                      ? "AI answer from event totals"
                      : "Answered by rules from event totals"}
                  </p>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex gap-1 px-1" aria-label="Thinking">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${d * 120}ms` }}
                />
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col items-stretch gap-2 border-t">
          {!busy && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-muted"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (isSubmitEnter(e)) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              placeholder="Ask about the event…"
              aria-label="Ask the Espoo Esbo assistant"
              className="max-h-32 min-h-10 resize-none"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
              <SendHorizonalIcon />
            </Button>
          </form>
        </CardFooter>
      </Card>

      <Button
        size="icon-lg"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Espoo Esbo assistant" : "Open Espoo Esbo assistant"}
        aria-expanded={open}
        className="fixed right-4 bottom-4 z-50 size-14 rounded-full shadow-lg [&_svg:not([class*='size-'])]:size-6"
      >
        {open ? <XIcon /> : <MessageCircleIcon />}
        {!open && messages.length === 1 && (
          <Badge className="absolute -top-1 -right-1 h-5 px-1.5 text-[10px]" aria-hidden>
            Ask
          </Badge>
        )}
      </Button>
    </>
  );
}
