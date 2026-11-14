"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  InfoIcon,
  SendHorizonalIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SkillChip } from "@/components/skill-chip";
import { EVENT } from "@/lib/data";
import { extractSkills, skillLabel, SKILLS } from "@/lib/esco";
import { poolCoverage } from "@/lib/match";
import { useDemo } from "@/lib/store";
import type { Need } from "@/lib/types";
import { cn } from "@/lib/utils";

type Msg = { from: "bot" | "user"; text: string; skills?: string[] };
type Stage = "role" | "tasks" | "priorities" | "practical" | "done";

const SUGGESTIONS: Record<"role" | "tasks", string> = {
  role: "We need a dev who can handle our data stuff — sensor telemetry from battery packs. Python ideally.",
  tasks:
    "Build pipelines from our test rigs to the cloud, clean the data, and make dashboards our engineers can actually explain to customers.",
};

const LANGS: Need["language"][] = ["English OK", "Finnish or English", "Finnish required"];
const MODES: Need["mode"][] = ["On-site", "Hybrid", "Remote"];

export function CompanyIntake() {
  const { talent, addNeed } = useDemo();
  const [stage, setStage] = useState<Stage>("role");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    {
      from: "bot",
      text: `Hi! The event is ${EVENT.weeksAway} weeks away. Describe the person you'd like to meet, in your own words. Rough is fine; I'll turn it into concrete skills.`,
    },
  ]);
  const [company, setCompany] = useState("Your company (demo)");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [must, setMust] = useState<string[]>([]);
  const [language, setLanguage] = useState<Need["language"]>("English OK");
  const [mode, setMode] = useState<Need["mode"]>("Hybrid");
  const [submitted, setSubmitted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const nice = skills.filter((s) => !must.includes(s));
  const coverage = useMemo(() => poolCoverage(must, talent), [must, talent]);
  const finnishSpeakers = talent.filter((t) =>
    t.languages.some((l) => l.lang === "Finnish" && l.level !== "Learning"),
  ).length;

  const push = (...m: Msg[]) => {
    setMessages((prev) => [...prev, ...m]);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setInput("");
    const found = extractSkills(t);
    if (stage === "role") {
      const merged = [...new Set([...skills, ...found])];
      setSkills(merged);
      setMust(found.slice(0, 3));
      if (!title)
        setTitle(
          found.includes("pipelines")
            ? "Data engineer"
            : found.length
              ? `${skillLabel(found[0])} specialist`
              : "New role",
        );
      setSummary(t);
      push(
        { from: "user", text: t },
        {
          from: "bot",
          text: found.length
            ? "Here's what I picked up, mapped to ESCO skills. What will this person actually do in their first three months?"
            : "I didn't catch specific skills yet. What will this person actually do in their first three months?",
          skills: found,
        },
      );
      setStage("tasks");
    } else if (stage === "tasks") {
      const added = found.filter((s) => !skills.includes(s));
      setSkills([...skills, ...added]);
      setSummary((s) => `${s} ${t}`.trim());
      push(
        { from: "user", text: t },
        {
          from: "bot",
          text: `${added.length ? "Added a few more. " : ""}Now tap skills on the card to mark the must-haves. Tip: every extra must-have shrinks the pool, so keep it to 2–3.`,
          skills: added,
        },
      );
      setStage("priorities");
    }
  };

  const toggleMust = (id: string) =>
    setMust((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  const toggleSkill = (id: string) => {
    setSkills((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    setMust((m) => m.filter((x) => x !== id));
  };

  const confirmPriorities = () => {
    push(
      { from: "user", text: `Must-haves: ${must.map(skillLabel).join(", ") || "none"}` },
      {
        from: "bot",
        text: "Last bit: practicalities. Is Finnish really needed to do the job from day one, or could someone learn it on the job? And how will they work?",
      },
    );
    setStage("practical");
  };

  const confirmPractical = () => {
    push(
      { from: "user", text: `${language} · ${mode}` },
      {
        from: "bot",
        text: `Your need card is ready. Submitting now, ${EVENT.weeksAway} weeks ahead, gives the organiser time to invite matching talent who aren't registered yet.`,
      },
    );
    setStage("done");
  };

  const submit = () => {
    const need: Need = {
      id: "N-YOU",
      company,
      companyBlurb: "Submitted through the intake chat",
      title: title || "New role",
      summary: summary.slice(0, 180),
      must,
      nice,
      language,
      mode,
      submittedWeeksBefore: EVENT.weeksAway,
      createdByUser: true,
    };
    addNeed(need);
    setSubmitted(true);
    toast.success("Need card sent to the organiser", {
      description: "It now appears in the organiser dashboard.",
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
      {/* Chat */}
      <Card className="flex min-h-[560px] flex-col">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <BotIcon className="size-4 text-primary" /> Intake assistant
          </CardTitle>
          <CardDescription>
            Structures your words into skills. It doesn&apos;t pick candidates.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 space-y-4 overflow-y-auto py-4">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  m.from === "user"
                    ? "rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-bl-md bg-muted",
                )}
              >
                <p>{m.text}</p>
                {m.skills && m.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.skills.map((s) => (
                      <SkillChip key={s} id={s} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {stage === "priorities" && (
            <div className="flex justify-start">
              <Button size="sm" onClick={confirmPriorities} disabled={!must.length}>
                <CheckIcon data-icon="inline-start" /> Must-haves look right
              </Button>
            </div>
          )}

          {stage === "practical" && (
            <div className="space-y-3 rounded-xl border p-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Working language</p>
                <div className="flex flex-wrap gap-1.5">
                  {LANGS.map((l) => (
                    <Button
                      key={l}
                      size="sm"
                      variant={language === l ? "default" : "outline"}
                      onClick={() => setLanguage(l)}
                    >
                      {l}
                    </Button>
                  ))}
                </div>
                {language === "Finnish required" && (
                  <p className="flex items-start gap-1.5 pt-1 text-xs text-transfer">
                    <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                    Only {finnishSpeakers} of {talent.length} people in the pool speak Finnish at working
                    level. If the role can be learned in English first, choose “Finnish or English”.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Way of working</p>
                <div className="flex flex-wrap gap-1.5">
                  {MODES.map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant={mode === m ? "default" : "outline"}
                      onClick={() => setMode(m)}
                    >
                      {m}
                    </Button>
                  ))}
                </div>
              </div>
              <Button size="sm" onClick={confirmPractical}>
                Continue <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          )}
          <div ref={endRef} />
        </CardContent>

        {(stage === "role" || stage === "tasks") && (
          <CardFooter className="flex-col items-stretch gap-2 border-t">
            <button
              type="button"
              onClick={() => setInput(SUGGESTIONS[stage])}
              className="flex items-center gap-1.5 self-start rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SparklesIcon className="size-3" /> Use example answer
            </button>
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
                placeholder={
                  stage === "role"
                    ? "e.g. someone to sort out our data…"
                    : "e.g. build pipelines, clean data…"
                }
                className="min-h-10 resize-none"
                rows={2}
              />
              <Button type="submit" size="icon-lg" aria-label="Send" disabled={!input.trim()}>
                <SendHorizonalIcon />
              </Button>
            </form>
          </CardFooter>
        )}
      </Card>

      {/* Live need card */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              Need card
              <Badge variant="outline" className="font-normal">
                live
              </Badge>
            </CardDescription>
            <div className="grid gap-3 pt-1">
              <div className="grid gap-1">
                <Label htmlFor="title" className="text-xs text-muted-foreground">
                  Role title
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Filled in from the chat"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="company" className="text-xs text-muted-foreground">
                  Company
                </Label>
                <Input id="company" value={company} onChange={(e) => setCompany(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Skills (ESCO) · tap to toggle must-have
              </p>
              {skills.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Skills appear here as you chat.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleMust(s)}
                      className={cn(
                        "flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors",
                        must.includes(s)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card hover:bg-muted",
                      )}
                    >
                      {must.includes(s) && <CheckIcon className="size-3" />}
                      {skillLabel(s)}
                    </button>
                  ))}
                </div>
              )}
              {stage !== "role" && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-foreground">
                    Add or remove skills
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {SKILLS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSkill(s.id)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 transition-colors hover:bg-muted",
                          skills.includes(s.id) && "border-primary/40 bg-accent text-accent-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
            <Separator />
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Language</dt>
                <dd>{language}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Mode</dt>
                <dd>{mode}</dd>
              </div>
            </dl>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            {submitted ? (
              <Button variant="outline" nativeButton={false} render={<Link href="/organiser" />}>
                See it in the organiser dashboard <ArrowRightIcon data-icon="inline-end" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={stage !== "done"}>
                Submit to organiser
              </Button>
            )}
          </CardFooter>
        </Card>

        <Alert>
          <UsersIcon />
          <AlertTitle>
            <span className="tabular-nums">{coverage}</span> of {talent.length} people in the pool already
            show evidence for your must-haves
          </AlertTitle>
          <AlertDescription>
            {must.length
              ? "Counted from verified scenario answers and work samples, not keyword-matched CVs."
              : "Mark must-haves to see how many candidates are already registered."}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
