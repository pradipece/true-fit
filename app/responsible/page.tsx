import type { Metadata } from "next";
import { CheckIcon, CircleAlertIcon, ScaleIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { SEED_NEEDS, SEED_TALENT } from "@/lib/data";
import { biasAudit, SUGGEST_THRESHOLD } from "@/lib/match";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Responsible AI" };

const DOES = [
  "Turns a company's free text into suggested ESCO skill tags, which they edit",
  "Translates job titles into local skill vocabulary",
  "Ranks pairs by transparent skill overlap and writes the reason in plain language",
  "Nudges companies away from requirements that shrink the pool without need",
];
const DOES_NOT = [
  "Reject, shortlist or contact anyone on its own",
  "Look at names, photos, nationality, age, school or language when matching",
  "Produce hidden scores. Every number has a visible breakdown",
  "Infer personality, emotion or “culture fit” from text or voice",
];

const DATA = [
  {
    item: "Skill card: skills, evidence answers, headline",
    purpose: "Matching and display",
    basis: "Consent",
    retention: "Event + 90 days",
  },
  {
    item: "Voice note audio",
    purpose: "Transcription only",
    basis: "Consent",
    retention: "Deleted after transcription (max 30 days)",
  },
  {
    item: "Name and contact details",
    purpose: "Shared after mutual opt-in",
    basis: "Consent",
    retention: "Event + 90 days",
  },
  {
    item: "Company need card",
    purpose: "Matching and display",
    basis: "Legitimate interest",
    retention: "Event + 12 months",
  },
  {
    item: "Organiser decisions and reasons",
    purpose: "Oversight and audit",
    basis: "Legal obligation (AI Act logging)",
    retention: "6 months minimum",
  },
  {
    item: "Self-declared group (optional)",
    purpose: "Aggregate fairness audit only",
    basis: "Explicit consent",
    retention: "Aggregated, then deleted",
  },
];

const AI_ACT = [
  {
    ref: "Annex III §4(a)",
    title: "High-risk classification",
    body: "AI used to place targeted job ads, filter applications or evaluate candidates is high-risk, so we design for it from day one.",
  },
  {
    ref: "Art. 10",
    title: "Data governance",
    body: "Synthetic data in the prototype; bias checks across groups; ESCO as a shared, auditable vocabulary.",
  },
  {
    ref: "Art. 12",
    title: "Record-keeping",
    body: "Every approval, rejection, edit and undo is logged with time, actor and reason in an append-only audit log, exportable as CSV.",
  },
  {
    ref: "Art. 13 & 50",
    title: "Transparency",
    body: "Both sides see why a match was suggested. People are told when the assistant is AI.",
  },
  {
    ref: "Art. 14",
    title: "Human oversight",
    body: "Organisers approve every match; both sides must opt in; any suggestion can be overridden or undone.",
  },
  {
    ref: "GDPR Art. 22",
    title: "No solely automated decisions",
    body: "The system never makes a decision with legal or similarly significant effect without a person.",
  },
];

export default function ResponsiblePage() {
  const audit = biasAudit(SEED_NEEDS, SEED_TALENT);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        step={5}
        eyebrow="Responsible & feasible"
        title="The AI suggests. People decide."
        description="What the system does, what it never does, what data it keeps and for how long, and a live fairness check on the synthetic pool."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The AI does</CardTitle>
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
          <CardDescription>Simple enough to explain to a candidate in one breath.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Must-have skill", "×3 weight"],
            ["Nice-to-have skill", "×1 weight"],
            ["Evidenced vs self-reported", "full vs half credit"],
            ["Related skill (transferable)", "partial credit, shown as →"],
          ].map(([a, b]) => (
            <div key={a} className="rounded-lg border bg-muted/30 p-3">
              <p className="font-medium">{a}</p>
              <p className="text-muted-foreground">{b}</p>
            </div>
          ))}
          <p className="text-muted-foreground sm:col-span-2 lg:col-span-4">
            Overlap = credit earned ÷ credit possible. Pairs above {Math.round(SUGGEST_THRESHOLD * 100)}% are
            shown as suggestions, but organisers can always see and approve anyone in the pool. Rule-based,
            not a trained model, so there are no learned proxies for protected characteristics.
          </p>
        </CardContent>
      </Card>

      {/* Bias check */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Fairness check on the synthetic pool</h2>
          <p className="text-sm text-muted-foreground">
            Share of people in each group who received at least one suggestion across all {SEED_NEEDS.length}{" "}
            needs. We flag any group below 80% of the best-served group (the “four-fifths rule”). Group data
            is optional, self-declared, and used only in aggregate.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {audit.map((a) => {
            const ok = a.ratio >= 0.8;
            return (
              <Card key={a.dim}>
                <CardHeader>
                  <CardTitle className="text-base">{a.label}</CardTitle>
                  <Badge
                    variant={ok ? "outline" : "destructive"}
                    className={cn(
                      "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                      ok && "border-evidence/30 text-evidence",
                    )}
                  >
                    {ok ? (
                      <CheckIcon data-icon="inline-start" />
                    ) : (
                      <CircleAlertIcon data-icon="inline-start" />
                    )}
                    ratio {a.ratio.toFixed(2)}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {a.rows.map((r) => (
                    <div key={r.group} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>
                          {r.group} <span className="text-muted-foreground">({r.people})</span>
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {Math.round(r.rate * 100)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${Math.max(r.rate * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {!ok && (
                    <p className="text-xs text-destructive">
                      Below 0.8: organisers review this group&apos;s rejections and recruit more matching
                      needs before the event.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">What we store, why, and for how long</CardTitle>
          <CardDescription>
            Data minimisation by default. Hosting in the EU; the city is the data controller.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Legal basis</TableHead>
                <TableHead>Retention</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DATA.map((d) => (
                <TableRow key={d.item}>
                  <TableCell className="font-medium whitespace-normal">{d.item}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{d.purpose}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{d.basis}</TableCell>
                  <TableCell className="whitespace-normal">{d.retention}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Act */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">EU AI Act & GDPR readiness</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AI_ACT.map((a) => (
            <Card key={a.ref} size="sm">
              <CardHeader>
                <CardDescription className="font-mono text-xs">{a.ref}</CardDescription>
                <CardTitle className="text-sm">{a.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{a.body}</CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
