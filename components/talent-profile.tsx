"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EyeOffIcon,
  FileTextIcon,
  LanguagesIcon,
  Loader2Icon,
  MicIcon,
  PlusIcon,
  QuoteIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  Undo2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { EscoMatch } from "@/components/esco-match";
import { VoiceNote } from "@/components/voice-note";
import { sampleToText, WorkSample, type Sample } from "@/components/work-sample";
import { SCENARIO_PROMPTS, VOICE_PROMPT } from "@/lib/data";
import { SKILLS, skillLabel } from "@/lib/esco";
import { useDemo } from "@/lib/store";
import {
  rulesEvidence,
  rulesStarters,
  rulesTranslate,
  type EvidenceAnswer,
  type EvidenceMapping,
  type EvidenceResult,
  type PrivacyFlag,
  type PromptIdeas,
  type Starters,
  type StartersRequest,
  type Translation,
} from "@/lib/talent-ai";
import type { Evidence, SkillGroup, Talent } from "@/lib/types";
import { cn, isSubmitEnter } from "@/lib/utils";

const GROUPS: SkillGroup[] = ["Digital", "Green transition", "Healthcare", "Business", "Transversal"];
const STEPS = ["Background", "Skills", "Evidence", "Review card"];
const MAX_PICK = 8;
const MAX_SKILLS = 10;

const SAMPLE_PROMPT = "Work sample file";

const EXAMPLES: Record<string, string> = {
  p1: "Our nightly stock report showed negative inventory. I checked the import log first because the numbers jumped overnight, found a duplicated file from the supplier, and added a check that rejects files with the same batch ID.",
  p2: "When we moved to a new warehouse system I had three weeks to learn SQL. I took the queries our analyst used, changed one thing at a time and wrote down what each part did. By the end I was writing our weekly report myself.",
  p3: "A driver and our ops lead kept arguing about late deliveries. I sat down with both, drew the delivery window on paper, and saw they meant different times. We agreed one definition and put it in the dashboard.",
  p4: "A small SQL query plus spreadsheet that ranks carriers by late deliveries per week. Our ops lead now uses it every Monday to decide which carrier to call.",
  voice:
    "A warehouse is like a giant library. If the popular books are at the back, everyone walks further. I used data to see which items people pick most, and we moved them to the front.",
};
const TITLE_EXAMPLES = ["Logistikkoordinator", "Jefe de almacén", "Lehrer", "Ingeniero de datos"];
const PATH_EXAMPLE =
  "Ran my family's restaurant for 8 years: purchasing, shift planning, leading a team of six. Then volunteered as an interpreter for an international NGO.";

const KIND_LABEL: Record<PrivacyFlag["kind"], string> = {
  name: "Name",
  contact: "Contact details",
  age: "Age",
  nationality: "Nationality or origin",
  school: "School",
  family: "Family or health",
  other: "Identifying detail",
};

const mapKey = (m: Pick<EvidenceMapping, "answerId" | "skill">) => `${m.answerId}:${m.skill}`;
const flagKey = (f: PrivacyFlag) => `${f.answerId}:${f.text}`;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const redact = (text: string, span: string) => text.replace(new RegExp(escapeRe(span), "gi"), "[removed]");

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return (await res.json()) as T;
}

function buildAnswers(answers: Record<string, string>, sample: Sample | null): EvidenceAnswer[] {
  const list: EvidenceAnswer[] = SCENARIO_PROMPTS.map((p, i) => ({
    id: p.id,
    kind: p.kind,
    label: `Answer ${i + 1}`,
    prompt: p.prompt,
    text: answers[p.id] ?? "",
  }));
  list.push({
    id: "voice",
    kind: "voice",
    label: "Voice note",
    prompt: VOICE_PROMPT,
    text: answers.voice ?? "",
  });
  list.push({
    id: "file",
    kind: "sample",
    label: "Work sample",
    prompt: SAMPLE_PROMPT,
    text: sampleToText(sample),
  });
  return list.filter((a) => a.text.trim());
}

const answersKey = (list: EvidenceAnswer[]) => JSON.stringify(list.map((a) => [a.id, a.text]));

export function TalentProfile() {
  const { addTalent } = useDemo();
  const [step, setStep] = useState(0);

  // 1. Background / translator
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [translating, setTranslating] = useState(false);

  // 2–3. Skills and evidence
  const [skills, setSkills] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sample, setSample] = useState<Sample | null>(null);
  const [starters, setStarters] = useState<Starters | null>(null);
  const [startersKey, setStartersKey] = useState("");
  const [loadingStarters, setLoadingStarters] = useState(false);

  // 4. Review
  const [result, setResult] = useState<EvidenceResult | null>(null);
  const [mappedKey, setMappedKey] = useState("");
  const [mapping, setMapping] = useState(false);
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [headline, setHeadline] = useState("");
  const [languages, setLanguages] = useState<string[]>(["English"]);
  const [mode, setMode] = useState<Talent["mode"]>("Any");
  const [availability, setAvailability] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [joined, setJoined] = useState(false);

  const answerList = buildAnswers(answers, sample);
  const labelOf = (id: string) => answerList.find((a) => a.id === id)?.label ?? id;
  const stale = !!result && answersKey(answerList) !== mappedKey;
  const accepted = (result?.mappings ?? []).filter(
    (m) => skills.includes(m.skill) && !rejected.has(mapKey(m)),
  );
  const evidenced = new Set(accepted.filter((m) => m.strength === "clear").map((m) => m.skill));
  const suggestions = [...new Set((result?.mappings ?? []).map((m) => m.skill))].filter(
    (s) => !skills.includes(s),
  );
  const openFlags = (result?.flags ?? []).filter((f) => !resolved.has(flagKey(f)));
  const written = SCENARIO_PROMPTS.filter(
    (p) => (answers[p.id] ?? "").trim().split(/\s+/).length >= 5,
  ).length;

  const touch = () => {
    setReviewed(false);
    setJoined(false);
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const translate = async () => {
    if (!title.trim() && !path.trim()) return;
    setTranslating(true);
    const body = { title, path };
    try {
      setTranslation(await postJson<Translation>("/api/talent/translate", body));
    } catch {
      setTranslation({ ...rulesTranslate(body), source: "rules" });
    }
    setTranslating(false);
  };

  const addSkills = (ids: string[], limit = MAX_PICK) => {
    setSkills((cur) => [...new Set([...cur, ...ids])].slice(0, Math.max(limit, cur.length)));
    touch();
  };
  const toggleSkill = (id: string) => {
    setSkills((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_PICK ? s : [...s, id]));
    touch();
  };

  const mapEvidence = async () => {
    if (!answerList.length) return;
    setMapping(true);
    const body = { answers: answerList, picked: skills, background: translation?.localTitle || title };
    let r: EvidenceResult;
    try {
      r = await postJson<EvidenceResult>("/api/talent/evidence", body);
    } catch {
      r = { ...rulesEvidence(body), source: "rules" };
    }
    setResult(r);
    setMappedKey(answersKey(answerList));
    setRejected(new Set());
    setResolved(new Set());
    if (!headline && r.headline) setHeadline(r.headline);
    setMapping(false);
    touch();
  };

  /** Writing ideas tailored to the picked skills and background; refreshed when those change. */
  const loadStarters = async () => {
    const body: StartersRequest = { picked: skills, background: translation?.localTitle || title, path };
    const key = JSON.stringify(body);
    if (key === startersKey) return;
    setStartersKey(key);
    setLoadingStarters(true);
    try {
      setStarters(await postJson<Starters>("/api/talent/starters", body));
    } catch {
      setStarters({ prompts: rulesStarters(body), source: "rules" });
    }
    setLoadingStarters(false);
  };

  const startWith = (id: string, starter: string) => {
    setAnswers((a) => (a[id]?.trim() ? a : { ...a, [id]: `${starter} ` }));
    touch();
  };

  const goTo = (i: number) => {
    setStep(i);
    if (i === 2) loadStarters();
    if (i === 3 && answerList.length && (!result || stale) && !mapping) mapEvidence();
  };

  const toggleMapping = (m: EvidenceMapping) => {
    setRejected((cur) => {
      const next = new Set(cur);
      if (next.has(mapKey(m))) next.delete(mapKey(m));
      else next.add(mapKey(m));
      return next;
    });
    touch();
  };

  /** Remove a flagged span everywhere it appears: the answer, and quotes already mapped. */
  const removeFlag = (f: PrivacyFlag) => {
    const nextAnswers = { ...answers };
    let nextSample = sample;
    if (f.answerId === "file" && sample)
      nextSample = {
        ...sample,
        description: redact(sample.description, f.text),
        excerpt: redact(sample.excerpt, f.text),
      };
    else nextAnswers[f.answerId] = redact(answers[f.answerId] ?? "", f.text);
    setAnswers(nextAnswers);
    setSample(nextSample);
    setHeadline((h) => redact(h, f.text));
    if (result)
      setResult({
        ...result,
        mappings: result.mappings.map((m) => ({ ...m, quote: redact(m.quote, f.text) })),
      });
    // Redaction doesn't change what the answers show, so the mapping stays current.
    setMappedKey(answersKey(buildAnswers(nextAnswers, nextSample)));
    setResolved((r) => new Set(r).add(flagKey(f)));
    touch();
  };

  const join = () => {
    const evidence: Evidence[] = answerList.flatMap((a) => {
      const ms = accepted.filter((m) => m.answerId === a.id);
      if (!ms.length) return [];
      return [
        {
          kind: a.kind,
          prompt: a.prompt,
          excerpt: [...new Set(ms.map((m) => m.quote))].join(" … ").slice(0, 260),
          skills: [...new Set(ms.map((m) => m.skill))],
        },
      ];
    });
    addTalent({
      id: "T-YOU",
      alias: "Candidate T-YOU",
      revealName: "You (demo)",
      headline: headline.trim() || "New at this event",
      previousField: translation?.localTitle || title.trim() || "—",
      skills: skills.map((id) => ({ id, level: evidenced.has(id) ? "evidenced" : "claimed" })),
      evidence,
      languages: languages.map((lang) => ({ lang, level: "Working" })),
      availability: availability.trim() || "Flexible",
      mode,
      // Demo placeholder: real audit attributes would come from an optional, separate equality survey.
      audit: { origin: "EU/EEA", education: "University", path: "Career changer" },
      createdByUser: true,
    });
    setJoined(true);
    toast.success("You're registered for the event", {
      description: "Companies with a matching need can now see your skill card and invite you.",
    });
  };

  const canJoin = skills.length > 0 && !!result && !stale && openFlags.length === 0 && reviewed;
  const joinHint = !skills.length
    ? "Pick at least one skill."
    : !result
      ? "Map your answers first."
      : stale
        ? "Your answers changed. Map them again."
        : openFlags.length
          ? "Resolve the privacy check first."
          : !reviewed
            ? "Tick the review box."
            : "";

  // ── Render ─────────────────────────────────────────────────────────────────

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
                  onClick={() => goTo(i)}
                  aria-current={i === step ? "step" : undefined}
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
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <LanguagesIcon className="size-4 text-primary" />
                <h3 className="font-medium">Skills translator</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Your last job title in any language, or your path in your own words: career changes, a family
                business, caring, volunteering. We translate it into skills and the words Finnish employers
                use.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="title">Past job title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => isSubmitEnter(e) && translate()}
                  placeholder="e.g. Logistikkoordinator, jefe de almacén, teacher…"
                />
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {TITLE_EXAMPLES.map((ex) => (
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
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="path">Or describe your path (optional)</Label>
                <Textarea
                  id="path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  rows={3}
                  placeholder="What you did, in plain words. No names, schools or places needed."
                />
                <button
                  type="button"
                  onClick={() => setPath(PATH_EXAMPLE)}
                  className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
                >
                  <SparklesIcon className="size-3" /> Example: an unusual path
                </button>
              </div>
              <Button onClick={translate} disabled={translating || (!title.trim() && !path.trim())}>
                {translating ? (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <LanguagesIcon data-icon="inline-start" />
                )}
                Translate to skills
              </Button>

              {translation && (
                <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm">
                      <span className="text-muted-foreground">In Finland: </span>
                      <span className="font-medium">{translation.localTitle || "No direct match"}</span>
                    </p>
                    <SourceBadge source={translation.source} />
                  </div>
                  {translation.note && <p className="text-xs text-transfer">{translation.note}</p>}
                  <EscoMatch
                    lookup={translation.esco}
                    picked={skills}
                    onToggle={toggleSkill}
                    onAddAll={(ids) => addSkills(ids)}
                  />
                  {translation.vocabulary.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Words to search for in job ads
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {translation.vocabulary.map((v) => (
                          <li key={v.term} className="rounded-md border bg-card px-2 py-1 text-xs">
                            <span className="font-medium">{v.term}</span>{" "}
                            <span className="text-muted-foreground">· {v.meaning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {translation.skills.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">
                          Skills this experience builds
                        </p>
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() => addSkills(translation.skills.map((s) => s.skill))}
                        >
                          <PlusIcon data-icon="inline-start" /> Add all
                        </Button>
                      </div>
                      <ul className="space-y-1">
                        {translation.skills.map((s) => (
                          <li key={s.skill} className="flex items-start gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => toggleSkill(s.skill)}
                              aria-pressed={skills.includes(s.skill)}
                              className="shrink-0"
                            >
                              <SkillChip
                                id={s.skill}
                                kind={skills.includes(s.skill) ? "claimed" : "neutral"}
                              />
                            </button>
                            <span className="pt-1 text-muted-foreground">{s.why}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No skills matched. Try describing what you did day to day, or pick skills in the next
                      step.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 1 && (
            <section className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">Pick up to {MAX_PICK} skills you&apos;d like to show</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {skills.length}/{MAX_PICK} selected
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                For now these are skills you say you have. Your answers in the next step can show them.
              </p>
              {GROUPS.map((g) => (
                <div key={g} className="space-y-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{g}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SKILLS.filter((s) => s.group === g).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSkill(s.id)}
                        aria-pressed={skills.includes(s.id)}
                        title={`ESCO: ${s.escoLabel}`}
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
          )}

          {step === 2 && (
            <section className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="max-w-prose text-sm text-muted-foreground">
                  Four short answers about real situations. Plain language and typos are fine: we look for
                  what you did, not polish. The ideas under each question are based on your skills
                  {translation?.localTitle || title ? " and background" : ""}; the answer is yours to write.
                </p>
                {starters && <SourceBadge source={starters.source} />}
              </div>
              {SCENARIO_PROMPTS.map((p, i) => {
                const text = answers[p.id] ?? "";
                const words = text.trim() ? text.trim().split(/\s+/).length : 0;
                return (
                  <div key={p.id} className="space-y-2 rounded-xl border p-4">
                    <div className="flex items-start gap-2">
                      {p.kind === "sample" ? (
                        <FileTextIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      ) : (
                        <QuoteIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                      )}
                      <div className="space-y-0.5">
                        <Label htmlFor={p.id} className="leading-snug">
                          {i + 1}. {p.prompt}
                        </Label>
                        <p className="text-xs text-muted-foreground">{p.hint}</p>
                      </div>
                    </div>
                    <IdeasFor
                      ideas={starters?.prompts[p.id as keyof Starters["prompts"]]}
                      loading={loadingStarters}
                      canStart={!text.trim()}
                      onStart={(st) => startWith(p.id, st)}
                    />
                    <Textarea
                      id={p.id}
                      value={text}
                      onChange={(e) => {
                        setAnswers((a) => ({ ...a, [p.id]: e.target.value }));
                        touch();
                      }}
                      rows={3}
                      placeholder="Your answer…"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="tabular-nums">{words} words</span>
                      <button
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, [p.id]: EXAMPLES[p.id] }))}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        <SparklesIcon className="size-3" /> Demo answer
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="space-y-4 rounded-xl border border-dashed p-4">
                <p className="text-sm font-medium">Optional extras</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MicIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="flex-1 space-y-0.5">
                      <p className="text-sm leading-snug">{VOICE_PROMPT}</p>
                      <button
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, voice: EXAMPLES.voice }))}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <SparklesIcon className="size-3" /> Demo transcript
                      </button>
                    </div>
                  </div>
                  <IdeasFor
                    ideas={starters?.prompts.voice}
                    loading={loadingStarters}
                    canStart={!(answers.voice ?? "").trim()}
                    onStart={(st) => startWith("voice", st)}
                  />
                  <VoiceNote
                    value={answers.voice ?? ""}
                    onChange={(text) => {
                      setAnswers((a) => ({ ...a, voice: text }));
                      touch();
                    }}
                  />
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <FileTextIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <p className="text-sm leading-snug">
                      Work sample: a script, query, plan or notes you wrote.
                    </p>
                  </div>
                  <WorkSample
                    value={sample}
                    onChange={(s) => {
                      setSample(s);
                      touch();
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">Which answer supports which skill</h3>
                  {result && <SourceBadge source={result.source} />}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={mapEvidence}
                  disabled={mapping || !answerList.length}
                >
                  <RefreshCwIcon data-icon="inline-start" className={cn(mapping && "animate-spin")} />
                  {result ? "Map again" : "Map my answers"}
                </Button>
              </div>

              {!answerList.length && (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Write at least one answer in step 3 first. Without answers, your skills count as stated, not
                  shown.
                </p>
              )}
              {stale && !mapping && (
                <p className="rounded-lg border border-transfer/30 bg-transfer-soft p-3 text-sm text-transfer">
                  You changed your answers since they were mapped. Map them again before joining.
                </p>
              )}
              {mapping && (
                <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" /> Reading your answers…
                </div>
              )}

              {result && !mapping && (
                <>
                  <ul className="space-y-3">
                    {skills.map((s) => {
                      const ms = result.mappings.filter((m) => m.skill === s);
                      return (
                        <li key={s} className="space-y-2 rounded-xl border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <SkillChip id={s} kind={evidenced.has(s) ? "evidenced" : "claimed"} />
                            <button
                              type="button"
                              onClick={() => toggleSkill(s)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Remove skill
                            </button>
                          </div>
                          {ms.length ? (
                            ms.map((m) => {
                              const off = rejected.has(mapKey(m));
                              return (
                                <div
                                  key={mapKey(m)}
                                  className={cn("flex gap-2 text-sm", off && "opacity-50")}
                                >
                                  <QuoteIcon className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <p className={cn("italic", off && "line-through")}>“{m.quote}”</p>
                                    <p className="text-xs text-muted-foreground">
                                      {labelOf(m.answerId)} ·{" "}
                                      <span className={m.strength === "clear" ? "text-evidence" : ""}>
                                        {m.strength === "clear" ? "clearly shows it" : "mentions it"}
                                      </span>{" "}
                                      · {m.why}
                                    </p>
                                  </div>
                                  <Button size="xs" variant="ghost" onClick={() => toggleMapping(m)}>
                                    {off ? <Undo2Icon data-icon="inline-start" /> : null}
                                    {off ? "Undo" : "Not right"}
                                  </Button>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No answer shows this yet, so it counts as stated. That&apos;s fine.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Your answers also show</p>
                      <ul className="space-y-2">
                        {suggestions.map((s) => {
                          const m = result.mappings.find((x) => x.skill === s)!;
                          return (
                            <li key={s} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2 text-sm">
                              <div className="min-w-0 flex-1 space-y-1">
                                <SkillChip id={s} />
                                <p className="text-xs text-muted-foreground">
                                  <span className="italic">“{m.quote}”</span> · {labelOf(m.answerId)}
                                </p>
                              </div>
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => addSkills([s], MAX_SKILLS)}
                                disabled={skills.length >= MAX_SKILLS}
                              >
                                <PlusIcon data-icon="inline-start" /> Add
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <PrivacyCheck
                    flags={openFlags}
                    labelOf={labelOf}
                    onRemove={removeFlag}
                    onKeep={(f) => {
                      setResolved((r) => new Set(r).add(flagKey(f)));
                      touch();
                    }}
                  />
                </>
              )}

              <Separator />

              <div className="space-y-5">
                <div className="grid gap-1.5">
                  <Label htmlFor="headline">One line about you, in your own words</Label>
                  <Input
                    id="headline"
                    value={headline}
                    maxLength={90}
                    onChange={(e) => {
                      setHeadline(e.target.value);
                      touch();
                    }}
                    placeholder="e.g. Ten years on a warehouse floor, now automating it with data."
                  />
                  {result?.headline && headline !== result.headline && (
                    <button
                      type="button"
                      onClick={() => setHeadline(result.headline)}
                      className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
                    >
                      <SparklesIcon className="size-3" /> Suggestion: {result.headline}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Languages you can work in</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["English", "Finnish", "Swedish", "Other"].map((l) => (
                      <Button
                        key={l}
                        size="sm"
                        variant={languages.includes(l) ? "default" : "outline"}
                        aria-pressed={languages.includes(l)}
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
                <div className="flex flex-wrap gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">How you&apos;d like to work</p>
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
                  <div className="grid gap-1.5">
                    <Label htmlFor="availability">Available from</Label>
                    <Input
                      id="availability"
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                      placeholder="e.g. February"
                      className="h-7 w-40"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Never on your card</p>
                  Name, photo, date of birth, nationality, school names or a CV. Your name and contact details
                  are shared only with companies you both agree to meet.
                </div>
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <Checkbox
                    checked={reviewed}
                    onCheckedChange={(c) => setReviewed(c === true)}
                    className="mt-0.5"
                  />
                  I&apos;ve checked my card. The skills and quotes are accurate, and nothing on it identifies
                  me.
                </label>
              </div>
            </section>
          )}
        </CardContent>

        <CardFooter className="justify-between gap-2 border-t">
          <Button variant="ghost" onClick={() => goTo(Math.max(0, step - 1))} disabled={step === 0}>
            <ArrowLeftIcon data-icon="inline-start" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => goTo(step + 1)} disabled={step === 1 && skills.length === 0}>
              {step === 2 ? "Review my card" : "Next"} <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : joined ? (
            <Button variant="outline" nativeButton={false} render={<Link href="/meetings/talent" />}>
              Go to your meetings <ArrowRightIcon data-icon="inline-end" />
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              {joinHint && <span className="hidden text-xs text-muted-foreground sm:inline">{joinHint}</span>}
              <Button onClick={join} disabled={!canJoin}>
                Join the event
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Live anonymised card */}
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
            {(translation?.localTitle || title) && (
              <p className="text-xs text-muted-foreground">
                Background: <span className="text-foreground">{translation?.localTitle || title}</span>
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
            {accepted.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
                  Evidence behind these skills ({accepted.length})
                </summary>
                <ul className="mt-2 space-y-2">
                  {accepted.map((m) => (
                    <li key={mapKey(m)} className="border-l-2 border-evidence/40 pl-2">
                      <p className="italic">“{m.quote}”</p>
                      <p className="text-muted-foreground">
                        {skillLabel(m.skill)} · {labelOf(m.answerId)}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <Separator />
            <dl className="space-y-1.5 text-sm">
              <Row label="Written answers" value={`${written}/${SCENARIO_PROMPTS.length}`} />
              <Row
                label="Extras"
                value={
                  [answers.voice?.trim() && "voice note", sample && "work sample"]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <Row label="Languages" value={languages.join(", ") || "—"} />
              <Row label="Mode" value={mode} />
              <Row label="Available" value={availability || "Flexible"} />
            </dl>
          </CardContent>
          <CardFooter>
            <SkillLegend className="flex-col items-start" />
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

function SourceBadge({ source }: { source: "ai" | "rules" }) {
  return (
    <Badge variant="outline" className="font-normal">
      {source === "ai" ? "AI" : "Basic mode"}
    </Badge>
  );
}

function PrivacyCheck({
  flags,
  labelOf,
  onRemove,
  onKeep,
}: {
  flags: PrivacyFlag[];
  labelOf: (id: string) => string;
  onRemove: (f: PrivacyFlag) => void;
  onKeep: (f: PrivacyFlag) => void;
}) {
  if (!flags.length)
    return (
      <p className="flex items-start gap-2 rounded-lg border border-evidence/30 bg-evidence-soft p-3 text-sm text-evidence">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
        Privacy check: no names, schools, ages or origins found in your answers. It isn&apos;t perfect, so
        give them a quick read too.
      </p>
    );
  return (
    <div className="space-y-2 rounded-lg border border-transfer/30 bg-transfer-soft p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-transfer">
        <ShieldAlertIcon className="size-4" /> Privacy check: {flags.length} detail{flags.length > 1 && "s"}{" "}
        could identify you
      </p>
      <ul className="space-y-2">
        {flags.map((f) => (
          <li key={`${f.answerId}:${f.text}`} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline" className="bg-card font-normal">
              {KIND_LABEL[f.kind]}
            </Badge>
            <mark className="rounded bg-card px-1">{f.text}</mark>
            <span className="text-xs text-muted-foreground">in {labelOf(f.answerId)}</span>
            <span className="ml-auto flex gap-1">
              <Button size="xs" onClick={() => onRemove(f)}>
                Remove it
              </Button>
              <Button size="xs" variant="ghost" onClick={() => onKeep(f)}>
                Keep
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Memory joggers and a half-sentence starter for one prompt. Never a full answer. */
function IdeasFor({
  ideas,
  loading,
  canStart,
  onStart,
}: {
  ideas?: PromptIdeas;
  loading: boolean;
  canStart: boolean;
  onStart: (starter: string) => void;
}) {
  if (loading && !ideas)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2Icon className="size-3 animate-spin" /> Tailoring ideas to your skills…
      </p>
    );
  if (!ideas) return null;
  return (
    <div className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2 text-xs">
      <p className="font-medium text-muted-foreground">Ideas for you</p>
      <ul className="space-y-0.5">
        {ideas.ideas.map((idea) => (
          <li key={idea} className="flex gap-1.5">
            <span className="text-primary">•</span> {idea}
          </li>
        ))}
      </ul>
      {canStart && ideas.starter && (
        <button
          type="button"
          onClick={() => onStart(ideas.starter)}
          className="flex items-center gap-1 text-left text-primary hover:underline"
        >
          <SparklesIcon className="size-3 shrink-0" /> Start with “{ideas.starter}…”
        </button>
      )}
    </div>
  );
}
