"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EyeOffIcon,
  FileTextIcon,
  LanguagesIcon,
  MicIcon,
  PlusIcon,
  QuoteIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { SCENARIO_PROMPTS } from "@/lib/data";
import { SKILLS, skillLabel, translateTitle } from "@/lib/esco";
import { useDemo } from "@/lib/store";
import type { Evidence, SkillGroup, Talent } from "@/lib/types";
import { cn } from "@/lib/utils";

const GROUPS: SkillGroup[] = ["Digital", "Green transition", "Healthcare", "Business", "Transversal"];
const STEPS = ["Skills", "Evidence", "Preferences"];
const EXAMPLES: Record<string, string> = {
  p1: "Our nightly stock report showed negative inventory. I checked the import log first because the numbers jumped overnight, found a duplicated file from the supplier, and added a check that rejects files with the same batch ID.",
  p2: "A warehouse is like a giant library. If the popular books are at the back, everyone walks further. I used data to move popular items to the front.",
  p3: "A small SQL query + spreadsheet that ranks carriers by late deliveries per week, which our ops lead now uses every Monday.",
};

export function TalentProfile() {
  const { addTalent } = useDemo();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, { text: string; skills: string[] }>>({});
  const [headline, setHeadline] = useState("");
  const [mode, setMode] = useState<Talent["mode"]>("Any");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [joined, setJoined] = useState(false);

  const translation = translateTitle(title);
  const evidenced = new Set(
    Object.values(answers)
      .filter((a) => a.text.trim().split(/\s+/).length >= 12)
      .flatMap((a) => a.skills),
  );
  const answered = Object.values(answers).filter((a) => a.text.trim().length > 0).length;

  const toggleSkill = (id: string) =>
    setSkills((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 8 ? s : [...s, id]));

  const setAnswer = (pid: string, patch: Partial<{ text: string; skills: string[] }>) =>
    setAnswers((a) => ({ ...a, [pid]: { ...(a[pid] ?? { text: "", skills: [] }), ...patch } }));

  const join = () => {
    const evidence: Evidence[] = SCENARIO_PROMPTS.filter((p) => answers[p.id]?.text.trim()).map((p) => ({
      kind: p.kind,
      prompt: p.prompt,
      excerpt: answers[p.id].text.trim().slice(0, 220),
      skills: answers[p.id].skills,
    }));
    addTalent({
      id: "T-YOU",
      alias: "Candidate T-YOU",
      revealName: "You (demo)",
      headline: headline || "New to the pool",
      previousField: translation?.localTitle ?? (title || "—"),
      skills: skills.map((id) => ({ id, level: evidenced.has(id) ? "evidenced" : "claimed" })),
      evidence,
      languages: languages.map((lang) => ({ lang, level: "Working" })),
      availability: "Flexible",
      mode,
      audit: { origin: "EU/EEA", education: "University", path: "Career changer" },
      createdByUser: true,
    });
    setJoined(true);
    toast.success("You're in the pool", {
      description: "The organiser will see your anonymised skill card.",
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors",
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="tabular-nums">{i + 1}</span>
                  <span className="hidden sm:inline">{s}</span>
                </button>
              ))}
            </div>
            <Progress value={((step + 1) / STEPS.length) * 100} className="w-24" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6 py-2">
          {step === 0 && (
            <>
              <section className="space-y-3 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <LanguagesIcon className="size-4 text-primary" />
                  <h3 className="font-medium">Skills translator</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Type a past job title in any language. We suggest matching skills and the local job
                  vocabulary.
                </p>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Logistikkoordinator, jefe de almacén, teacher…"
                />
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {["Logistikkoordinator", "Jefe de almacén", "Lehrer", "Ingeniero de datos"].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setTitle(ex)}
                      className="rounded-full border border-dashed px-2.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                {translation && (
                  <div className="space-y-2 rounded-lg border bg-card p-3">
                    <p className="text-sm">
                      <span className="text-muted-foreground">In Finland: </span>
                      <span className="font-medium">{translation.localTitle}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {translation.skills.map((s) => (
                        <SkillChip key={s} id={s} kind={skills.includes(s) ? "claimed" : "neutral"} />
                      ))}
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() =>
                          setSkills((cur) => [...new Set([...cur, ...translation.skills])].slice(0, 8))
                        }
                      >
                        <PlusIcon data-icon="inline-start" /> Add all
                      </Button>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium">Pick up to 8 skills</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {skills.length}/8 selected
                  </span>
                </div>
                {GROUPS.map((g) => (
                  <div key={g} className="space-y-2">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{g}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SKILLS.filter((s) => s.group === g).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSkill(s.id)}
                          className={cn(
                            "h-7 rounded-full border px-3 text-xs transition-colors",
                            skills.includes(s.id)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card hover:bg-muted",
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Short, concrete answers. Tag which of your skills each one shows; a tagged skill with a real
                answer becomes <span className="font-medium text-evidence">evidenced</span>. Typos and plain
                language are fine; we&apos;re looking for how you think, not polish.
              </p>
              {SCENARIO_PROMPTS.map((p) => {
                const a = answers[p.id] ?? { text: "", skills: [] };
                const Icon = p.kind === "voice" ? MicIcon : p.kind === "sample" ? FileTextIcon : QuoteIcon;
                return (
                  <div key={p.id} className="space-y-2 rounded-xl border p-4">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="space-y-0.5">
                        <Label htmlFor={p.id} className="leading-snug">
                          {p.prompt}
                        </Label>
                        <p className="text-xs text-muted-foreground">{p.hint}</p>
                      </div>
                    </div>
                    <Textarea
                      id={p.id}
                      value={a.text}
                      onChange={(e) => setAnswer(p.id, { text: e.target.value })}
                      rows={3}
                      placeholder={p.kind === "voice" ? "Transcript of your voice note…" : "Your answer…"}
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Shows:</span>
                      {skills.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">
                          pick skills in step 1 first
                        </span>
                      )}
                      {skills.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            setAnswer(p.id, {
                              skills: a.skills.includes(s)
                                ? a.skills.filter((x) => x !== s)
                                : [...a.skills, s],
                            })
                          }
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-xs transition-colors",
                            a.skills.includes(s)
                              ? "border-evidence/40 bg-evidence-soft text-evidence"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {skillLabel(s)}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAnswer(p.id, { text: EXAMPLES[p.id] })}
                        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <SparklesIcon className="size-3" /> Example
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-1.5">
                <Label htmlFor="headline">One line about you, in your own words</Label>
                <Input
                  id="headline"
                  value={headline}
                  maxLength={90}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Ten years on a warehouse floor, now automating it with data."
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Languages you can work in</p>
                <div className="flex flex-wrap gap-1.5">
                  {["English", "Finnish", "Swedish", "Other"].map((l) => (
                    <Button
                      key={l}
                      size="sm"
                      variant={languages.includes(l) ? "default" : "outline"}
                      onClick={() =>
                        setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))
                      }
                    >
                      {l}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Shown to companies as information only. Language is never part of the match score.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">How you&apos;d like to meet and work</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["Any", "On-site", "Hybrid", "Remote"] as const).map((m) => (
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
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Not collected at all</p>
                Photo, date of birth, nationality, school names, full CV. Your name and contact details are
                shared only with companies you both agree to meet.
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-between border-t">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeftIcon data-icon="inline-start" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && skills.length === 0}>
              Next <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : joined ? (
            <Button variant="outline" nativeButton={false} render={<Link href="/organiser" />}>
              Go to organiser view <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : (
            <Button onClick={join} disabled={skills.length === 0}>
              Join the event pool
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Preview */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardDescription>What companies see first</CardDescription>
            <CardTitle className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-secondary">
                <EyeOffIcon className="size-4 text-muted-foreground" />
              </span>
              Candidate T-YOU
            </CardTitle>
            <Badge
              variant="outline"
              className="col-start-2 row-span-2 row-start-1 self-start justify-self-end"
            >
              {evidenced.size} evidenced
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              {headline || <span className="text-muted-foreground italic">Your one-line headline</span>}
            </p>
            {translation && (
              <p className="text-xs text-muted-foreground">
                Background: <span className="text-foreground">{translation.localTitle}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {skills.length ? (
                skills.map((s) => (
                  <SkillChip key={s} id={s} kind={evidenced.has(s) ? "evidenced" : "claimed"} />
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No skills picked yet</span>
              )}
            </div>
            <Separator />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Evidence answers</span>
                <span className="tabular-nums">
                  {answered}/{SCENARIO_PROMPTS.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Languages</span>
                <span>{languages.join(", ") || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span>{mode}</span>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <SkillLegend className="flex-col items-start" />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
