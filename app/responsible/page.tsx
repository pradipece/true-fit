import type { Metadata } from "next";
import {
  BotIcon,
  CheckIcon,
  CircleAlertIcon,
  CogIcon,
  FlaskConicalIcon,
  ScaleIcon,
  UserCheckIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { biasAudit, SCORING, SUGGEST_THRESHOLD } from "@/lib/match";
import { getSeed } from "@/lib/seed-db";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Responsible AI" };

// ── Who decides what ─────────────────────────────────────────────────────────

const DECISIONS = [
  {
    step: "What the company needs",
    machine: "AI drafts a need card from the chat and suggests ESCO skills",
    kind: "ai",
    human: "The company edits every field and approves the card",
  },
  {
    step: "What's on a skill card",
    machine: "AI suggests skills, the answer that supports each one, and flags identifying details",
    kind: "ai",
    human: "The candidate accepts or rejects each link, edits the card and decides to join",
  },
  {
    step: "How well skills overlap",
    machine: "Transparent rules calculate the overlap. No AI, no hidden score",
    kind: "rules",
    human: "Anyone can open the line-by-line calculation",
  },
  {
    step: "Which matches go ahead",
    machine: `Rules suggest pairs at ${Math.round(SUGGEST_THRESHOLD * 100)}%+ overlap; everyone else stays listed`,
    kind: "rules",
    human: "An organiser approves or rejects each pair, always with a reason",
  },
  {
    step: "Whether to meet",
    machine: "Nothing",
    kind: "none",
    human: "Both sides opt in; names are revealed only then",
  },
  {
    step: "What happens next",
    machine: "Nothing",
    kind: "none",
    human: "Both sides, in their own feedback",
  },
] as const;

const KIND = {
  ai: {
    label: "AI suggests",
    icon: BotIcon,
    className: "border-primary/30 bg-accent text-accent-foreground",
  },
  rules: { label: "Rules", icon: CogIcon, className: "border-border bg-secondary text-secondary-foreground" },
  none: { label: "No automation", icon: UserCheckIcon, className: "border-dashed text-muted-foreground" },
} as const;

const DOES = [
  "Asks a company clarifying questions and drafts a need card they edit and approve",
  "Translates job titles and unusual career paths into ESCO skills and Finnish job-ad words, with the official ESCO occupation alongside",
  "Suggests which answer supports which skill, quoting the candidate's own words verbatim (invented quotes are dropped)",
  "Flags names, schools, ages and other identifying details so the candidate can remove them",
  "Offers writing ideas and sentence starters, never full answers",
  "Writes a plain-language “why this match” from the rule-based score",
];
const DOES_NOT = [
  "Reject, shortlist, rank for hiring or contact anyone on its own",
  "Calculate the match score. That is transparent rules, covered by automated tests",
  "See names, photos, nationality, age, school or language when scoring",
  "Infer personality, emotion or “culture fit” from text or voice",
  "Write a candidate's answers or rate people. Feedback rates the meeting and the cards",
  "Train a model on anyone's data",
];

// ── Data ─────────────────────────────────────────────────────────────────────

const DATA = [
  {
    item: "Intake chat messages",
    why: "Turn the company's words into a need card",
    sent: "Gemini",
    retention: "Not kept once the card is approved",
  },
  {
    item: "Company need card",
    why: "Matching and display to organisers and matched candidates",
    sent: "—",
    retention: "Event + 12 months",
  },
  {
    item: "Skill card: skills, accepted evidence quotes, headline, languages, availability",
    why: "Matching and display (anonymised until mutual opt-in)",
    sent: "—",
    retention: "Event + 90 days, or until the candidate deletes it",
  },
  {
    item: "Full written answers and work-sample text",
    why: "Suggest which answer supports which skill",
    sent: "Gemini",
    retention: "Not stored; only quotes the candidate accepts are kept",
  },
  {
    item: "Voice note audio",
    why: "Live transcript on the candidate's device",
    sent: "Never leaves the device",
    retention: "Not stored; only the edited transcript is used",
  },
  {
    item: "Job title or skill words typed into a search",
    why: "Look up official ESCO occupations and skills",
    sent: "ESCO API (European Commission)",
    retention: "Cached for 1 day; no personal data",
  },
  {
    item: "Name and contact details",
    why: "Shared only after both sides opt in",
    sent: "—",
    retention: "Event + 90 days",
  },
  {
    item: "Opt-in answers and booked slots",
    why: "Scheduling the 10-minute meetings",
    sent: "—",
    retention: "Event + 30 days",
  },
  {
    item: "Post-meeting feedback",
    why: "Impact reporting and improving the next event",
    sent: "—",
    retention: "Ratings aggregated; ideas anonymised; event + 12 months",
  },
  {
    item: "Organiser decisions and audit log",
    why: "Human oversight and AI Act record-keeping",
    sent: "—",
    retention: "At least 6 months (AI Act Art. 26(6)), then reviewed",
  },
  {
    item: "Optional equality data: origin, education, career path",
    why: "Aggregate fairness check only, never read by matching",
    sent: "—",
    retention: "Aggregated after the event, then deleted",
  },
];

// ── EU AI Act ────────────────────────────────────────────────────────────────

const AI_ACT = [
  {
    ref: "Art. 9–11",
    title: "Risk management & documentation",
    today: "Documented design, rule-based scoring and a test suite for fairness and privacy guards.",
    production: "Provider's risk-management system and technical documentation before go-live.",
  },
  {
    ref: "Art. 10",
    title: "Data governance & bias",
    today: "Synthetic data only; ESCO as a shared, auditable vocabulary; group bias check below.",
    production: "Bias monitoring on real (consented, aggregated) data each event; corrective actions logged.",
  },
  {
    ref: "Art. 12 & 26(6)",
    title: "Logging",
    today:
      "Append-only audit log of every approval, rejection, edit and undo with time, actor and reason; CSV export.",
    production:
      "Also log each AI call (route, model, time, input hash, output) server-side; keep logs ≥ 6 months.",
  },
  {
    ref: "Art. 13, 26(11) & 50",
    title: "Transparency",
    today:
      "The chat is labelled as AI; every suggestion shows why; both sides see the explanation before opting in.",
    production:
      "Plain-language notice to candidates and companies that a high-risk AI system supports matching.",
  },
  {
    ref: "Art. 14",
    title: "Human oversight",
    today:
      "Organisers approve every match; nobody is rejected automatically; both sides opt in; decisions can be edited or undone.",
    production:
      "Trained organisers with authority to override; spot checks of rejected and non-suggested people.",
  },
  {
    ref: "Art. 15",
    title: "Accuracy & robustness",
    today:
      "Quotes must appear verbatim; skill ids are constrained to ESCO; AI failures fall back or show an error, never a guess.",
    production: "Accuracy targets from feedback (card accuracy ratings) and an incident process.",
  },
  {
    ref: "Art. 27",
    title: "Fundamental rights impact assessment",
    today: "Not done for the prototype.",
    production: "Required: the City is a public body deploying a high-risk system, so a FRIA comes first.",
  },
  {
    ref: "Art. 49 & 86",
    title: "Registration & right to explanation",
    today: "Every match already has a plain-language explanation.",
    production: "Register in the EU database; handle explanation requests from affected people.",
  },
];

export default async function ResponsiblePage() {
  const { needs: SEED_NEEDS, talent: SEED_TALENT, source } = await getSeed();
  const audit = biasAudit(SEED_NEEDS, SEED_TALENT);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
      <PageHeader
        step={5}
        eyebrow="Responsible & feasible"
        title="The AI suggests. People decide."
        description="Who decides what, what the AI does and never does, a live bias check on the synthetic pool, what data is kept and for how long, and how this maps to the EU AI Act."
      />

      {/* Who decides what */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Who decides what</h2>
          <p className="text-sm text-muted-foreground">
            Every step that affects a person ends with a human decision. Automation only prepares it.
          </p>
        </div>
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>What the system does</TableHead>
                  <TableHead>Who decides</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DECISIONS.map((d) => {
                  const k = KIND[d.kind];
                  return (
                    <TableRow key={d.step}>
                      <TableCell className="font-medium whitespace-normal">{d.step}</TableCell>
                      <TableCell className="whitespace-normal">
                        <Badge variant="outline" className={cn("mb-1 font-normal", k.className)}>
                          <k.icon data-icon="inline-start" /> {k.label}
                        </Badge>
                        <p className="text-muted-foreground">{d.machine}</p>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <span className="flex items-start gap-1.5">
                          <UserCheckIcon className="mt-0.5 size-4 shrink-0 text-evidence" /> {d.human}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The AI does</CardTitle>
            <CardDescription>
              Google Gemini, called only from our server, plus the EU&apos;s ESCO API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {DOES.map((d) => (
                <li key={d} className="flex gap-2 text-sm">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-evidence" /> {d}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The AI never</CardTitle>
            <CardDescription>By design, and checked by automated tests where it can be.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {DOES_NOT.map((d) => (
                <li key={d} className="flex gap-2 text-sm">
                  <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" /> {d}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* How matching works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScaleIcon className="size-4" /> How a suggestion is calculated
          </CardTitle>
          <CardDescription>
            Simple enough to explain to a candidate in one breath. No AI involved.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Must-have skill", `×${SCORING.mustWeight} weight`],
            ["Nice-to-have skill", `×${SCORING.niceWeight} weight`],
            ["Evidenced vs self-reported", `full vs ${SCORING.claimed * 100}% credit`],
            ["Related skill (transferable)", `relation × level × ${SCORING.transferFactor}, shown as →`],
          ].map(([a, b]) => (
            <div key={a} className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">{a}</p>
              <p className="text-muted-foreground">{b}</p>
            </div>
          ))}
          <p className="text-muted-foreground sm:col-span-2 lg:col-span-4">
            Overlap = credit earned ÷ credit possible. Pairs at {Math.round(SUGGEST_THRESHOLD * 100)}% or more
            are shown as suggestions, but organisers see and can approve anyone in the pool. Rule-based, not a
            trained model, so there are no learned proxies for protected characteristics.
          </p>
          <p className="flex items-start gap-1.5 text-muted-foreground sm:col-span-2 lg:col-span-4">
            <FlaskConicalIcon className="mt-0.5 size-4 shrink-0 text-evidence" />
            Automated tests prove the scorer never reads name, origin, language, education, career path, age
            or availability: two people with the same skills always get the same score, whatever their
            background.
          </p>
        </CardContent>
      </Card>

      {/* Bias check */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Bias check on the synthetic pool</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            For each group: the share of people with at least one suggestion across all {SEED_NEEDS.length}{" "}
            needs (the match rate), and their average best skill overlap. Any group below 80% of the
            best-served group’s match rate is flagged (the “four-fifths rule”). Since scoring uses skills
            only, a gap points to the pool or the needs, for example too few needs in a field, not to the
            scorer.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {audit.map((a) => {
            const ok = a.ratio >= 0.8;
            return (
              <Card key={a.dim}>
                <CardHeader>
                  <CardTitle className="text-base">{a.label}</CardTitle>
                  <CardDescription>
                    {ok
                      ? "Balanced: every group is matched at a similar rate."
                      : "Worth a look: one group is matched noticeably less often."}
                  </CardDescription>
                  <Badge
                    variant="outline"
                    className={cn(
                      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                      ok ? "border-evidence/30 text-evidence" : "border-transfer/40 text-transfer",
                    )}
                  >
                    {ok ? (
                      <CheckIcon data-icon="inline-start" />
                    ) : (
                      <CircleAlertIcon data-icon="inline-start" />
                    )}
                    {ok ? "Balanced" : "Check"} · ratio {a.ratio.toFixed(2)}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group</TableHead>
                        <TableHead className="w-2/5">Match rate</TableHead>
                        <TableHead className="text-right">Avg best overlap</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {a.rows.map((r) => (
                        <TableRow key={r.group}>
                          <TableCell className="whitespace-normal">
                            {r.group} <span className="text-muted-foreground">({r.people})</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-muted">
                                <div
                                  className="h-2 rounded-full bg-primary"
                                  style={{ width: `${Math.max(r.rate * 100, 2)}%` }}
                                />
                              </div>
                              <span className="w-9 text-right text-xs tabular-nums">
                                {Math.round(r.rate * 100)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {Math.round(r.avgBest * 100)}%
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {!ok && (
                    <p className="mt-2 text-xs text-transfer">
                      Below 0.8: organisers check rejections for this group and invite more needs that fit its
                      skills before the event.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Group data is optional, self-declared and used only in aggregate. Synthetic pool of{" "}
          {SEED_TALENT.length} people, loaded from{" "}
          {source === "supabase" ? "the Supabase database" : "the bundled seed files"}; with real data the
          same check runs before every event.
        </p>
      </section>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What we store, why, and for how long</CardTitle>
          <CardDescription>
            Data minimisation by default. In production: EU hosting, the City as data controller, and AI
            providers under a data processing agreement. The prototype keeps demo data only in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Why</TableHead>
                <TableHead>Sent to</TableHead>
                <TableHead>Retention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DATA.map((d) => (
                <TableRow key={d.item}>
                  <TableCell className="font-medium whitespace-normal">{d.item}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{d.why}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{d.sent}</TableCell>
                  <TableCell className="whitespace-normal">{d.retention}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Act */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">EU AI Act note</h2>
          <p className="text-sm text-muted-foreground">
            How the design maps to the AI Act, and what a real deployment would still need. Not legal advice.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardDescription className="font-mono text-xs">Annex III, point 4(a) · Art. 6</CardDescription>
              <CardTitle className="text-base">High-risk classification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                AI used for recruitment or selection, including placing targeted job ads, analysing and
                filtering applications and evaluating candidates, is listed as high-risk. Matching people to
                company needs falls here, so we treat the whole system as high-risk.
              </p>
              <p>
                The Art. 6(3) exemption for narrow, preparatory tasks doesn&apos;t apply: the system profiles
                people&apos;s skills, and profiling is always high-risk.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription className="font-mono text-xs">Roles & timing</CardDescription>
              <CardTitle className="text-base">Who is responsible</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                The City of Espoo would be the <span className="text-foreground">deployer</span> (it uses the
                system for its events); whoever builds and places it on the market is the{" "}
                <span className="text-foreground">provider</span>. Both have duties, listed below.
              </p>
              <p>
                Check the application date for Annex III obligations before deployment: the original timeline
                is 2 August 2026, and EU proposals have sought to move it later.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Requirement</TableHead>
                  <TableHead>Prototype today</TableHead>
                  <TableHead>For a real deployment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {AI_ACT.map((a) => (
                  <TableRow key={a.ref}>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{a.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">{a.ref}</p>
                    </TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{a.today}</TableCell>
                    <TableCell className="whitespace-normal">{a.production}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          GDPR Art. 22 also applies: no decision with legal or similarly significant effect is made without a
          person. Here every such step ends with a human choice.
        </p>
      </section>
    </div>
  );
}
