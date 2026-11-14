"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  Building2Icon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  DownloadIcon,
  HandIcon,
  HandshakeIcon,
  LanguagesIcon,
  ListChecksIcon,
  NetworkIcon,
  SearchIcon,
  UsersIcon,
  MailIcon,
  MapPinIcon,
  MessageSquareIcon,
  PhoneIcon,
  PencilIcon,
  ScaleIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AiFitBadge, RankToggle, useAiRanking } from "@/components/ai-rank";
import { MatchPanel, type CompanyScore } from "@/components/candidate-profile";
import { CompanyRanking } from "@/components/company-ranking";
import { MatchExplanationView } from "@/components/match-explanation";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { WhyThisMatch } from "@/components/why-this-match";
import { companiesFor } from "@/lib/explore";
import { pairKey, SUGGEST_THRESHOLD } from "@/lib/match";
import { auditCsv, OTHER, REASONS, reasonError, reviewList } from "@/lib/oversight";
import { useDemo } from "@/lib/store";
import type { AuditEntry, Decision, Feedback, MatchExplanation, Need, Talent } from "@/lib/types";
import { cn } from "@/lib/utils";

type DialogType = "approve" | "reject" | "edit" | "revert";
type DialogState = { type: DialogType; m: MatchExplanation; current?: Decision };

const REVERT_REASONS = ["Decided too early", "Waiting for more information", "Clicked by mistake"];

const reasonsFor = (type: DialogType) =>
  type === "revert" ? REVERT_REASONS : type === "edit" ? [...REASONS.edit] : [...REASONS[type]];

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const displayName = (t?: Talent) => t && (t.contact?.fullName ?? t.revealName);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const ACTION_STYLE: Record<AuditEntry["action"], string> = {
  approved: "border-evidence/30 bg-evidence-soft text-evidence",
  rejected: "border-border bg-secondary text-secondary-foreground",
  edited: "border-transfer/30 bg-transfer-soft text-transfer",
  reverted: "border-dashed",
};

type OptInRow = { company?: boolean; talent?: boolean };

const answerLabel = (v: boolean | undefined) => (v === true ? "Yes" : v === false ? "No" : "Not yet");

/** Where an introduction stands after the organiser made it. */
function pipelineLabel(o: OptInRow | undefined, slot: string | undefined, fb: Feedback | undefined) {
  if (fb?.company && fb?.talent) return "Feedback from both sides";
  if (fb?.company || fb?.talent) return "Feedback from one side";
  if (slot) return `Meeting at ${slot}`;
  if (o?.company === false || o?.talent === false) return "One side said no";
  if (o?.company && o?.talent) return "Both said yes, time to book";
  if (o?.company) return "Company said yes, waiting for the candidate";
  if (o?.talent) return "Candidate said yes, waiting for the company";
  return "Waiting for both to answer";
}

/**
 * The organiser, the event's broker (City of Espoo), reviews the people suggested for every
 * company's needs and decides, with a reason, whom to introduce. Matching only suggests;
 * nothing is automatic and every decision is logged. An introduction is not a meeting: the
 * company and the candidate each say yes or no in their own Introductions / Meetings view.
 */
export function OrganiserReview() {
  const { needs, talent, decisions, audit, optIns, slots, feedback, decide, undoDecision } = useDemo();
  const [selected, setSelected] = useState<string>(needs[0]?.id ?? "");
  const [showOthers, setShowOthers] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [view, setView] = useState<"need" | "candidate">("need");
  const [candidate, setCandidate] = useState<string>("");
  // From a card in the need view: open this person in "By candidate" to pick another company.
  const otherCompany = (talentId: string) => {
    setCandidate(talentId);
    setView("candidate");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const need = needs.find((n) => n.id === selected) ?? needs[0];
  const list = useMemo(() => (need ? reviewList(need, talent) : null), [need, talent]);
  const talentById = useMemo(() => new Map(talent.map((t) => [t.id, t])), [talent]);
  const ranking = useAiRanking(need, list?.suggested ?? [], talentById);
  const [tab, setTab] = useState<"review" | "pipeline" | "log">("review");
  const awaitingReview = needs.reduce(
    (sum, n) =>
      sum + reviewList(n, talent).suggested.filter((m) => !decisions[pairKey(m.needId, m.talentId)]).length,
    0,
  );

  const pipeline = (key: string) => pipelineLabel(optIns[key], slots[key], feedback[key]);
  // Every company ranked for each person, so a card can show where this need's company stands.
  const companyScores = useMemo(
    () =>
      new Map(
        talent.map((t) => [
          t.id,
          companiesFor(needs, t).map((c): CompanyScore => ({
            id: c.companyId,
            name: c.best.need.company,
            score: c.best.m.score,
            strong: c.strong,
          })),
        ]),
      ),
    [needs, talent],
  );
  const introductions = useMemo(
    () =>
      Object.entries(decisions)
        .filter(([, d]) => d.status === "approved")
        .map(([key, d]) => {
          const [needId, talentId] = key.split("::");
          return { key, d, need: needs.find((n) => n.id === needId), t: talentById.get(talentId) };
        })
        .filter((r) => r.need && r.t)
        .sort((a, b) => b.d.at.localeCompare(a.d.at)),
    [decisions, needs, talentById],
  );

  const confirm = (reason: string, note: string, status?: Decision["status"]) => {
    if (!dialog) return;
    const key = pairKey(dialog.m.needId, dialog.m.talentId);
    const n = note.trim() || undefined;
    if (dialog.type === "revert") {
      undoDecision(key, reason);
      toast("Decision withdrawn", { description: "Back in the review list. Logged in the audit trail." });
    } else {
      const next = dialog.type === "edit" ? status! : dialog.type === "approve" ? "approved" : "rejected";
      decide(key, { status: next, reason, note: n });
      // An introduction is not a yes from either side: both answer in their own view.
      toast.success(
        dialog.type === "edit"
          ? `Decision changed to ${next === "approved" ? "introduced" : "not now"}`
          : next === "approved"
            ? "Introduction sent"
            : "Passed for this need, with reason logged",
        {
          description:
            next === "approved"
              ? "The company and the candidate each see it in their own view and answer yes or no."
              : "The candidate can still be introduced for other needs.",
        },
      );
    }
    setDialog(null);
  };

  const exportCsv = () => {
    const blob = new Blob([auditCsv(audit, needs, talent)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "truefit-introductions-log.csv",
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const card = (m: MatchExplanation) => {
    const t = talentById.get(m.talentId)!;
    const key = pairKey(m.needId, m.talentId);
    const d = decisions[key];
    return (
      <MatchCard
        key={key}
        need={need!}
        m={m}
        t={t}
        decision={d}
        status={d?.status === "approved" ? pipeline(key) : undefined}
        asked={!d && optIns[key]?.talent === true}
        companyAsked={!d && optIns[key]?.company === true}
        companies={companyScores.get(m.talentId) ?? []}
        fit={ranking.fitOf(m.talentId)}
        onAction={(type) => setDialog({ type, m, current: d })}
        onOtherCompany={() => otherCompany(m.talentId)}
      />
    );
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-6">
      <TabsList className="h-10">
        <TabsTrigger value="review" className="px-3">
          <ListChecksIcon /> Suitable candidates
          {awaitingReview > 0 && (
            <Badge className="ml-1 h-5 min-w-5 px-1.5 tabular-nums">{awaitingReview}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="pipeline" className="px-3">
          <NetworkIcon /> All introductions
          {introductions.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 tabular-nums">
              {introductions.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="log" className="px-3">
          <ClipboardListIcon /> Decisions log
        </TabsTrigger>
      </TabsList>

      <TabsContent value="review" className="space-y-6">
        <p className="flex items-start gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <ScaleIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">You decide whom to introduce.</span> The company and
            the candidate then each say yes or no; nobody meets without both. Nobody is rejected
            automatically: people below the {Math.round(SUGGEST_THRESHOLD * 100)}% suggestion line are listed
            too. The order comes from skills only; there are no hidden scores, and every percentage is a skill
            match you can open. Names and contact details are fictional demo data.
          </span>
        </p>

        <div className="flex w-fit gap-1 rounded-lg border p-0.5 text-sm" role="group" aria-label="Review by">
          {(
            [
              ["need", "By company need", Building2Icon],
              ["candidate", "By candidate", UsersIcon],
            ] as const
          ).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground",
                view === v && "bg-secondary text-foreground",
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>

        {view === "candidate" && (
          <ByCandidate
            needs={needs}
            talent={talent}
            decisions={decisions}
            optIns={optIns}
            selected={candidate}
            onSelect={setCandidate}
            onAction={(type, m) => setDialog({ type, m, current: decisions[pairKey(m.needId, m.talentId)] })}
          />
        )}

        {view === "need" && needs.length === 0 && (
          <Card>
            <CardContent className="space-y-3 py-10 text-center">
              <p className="text-muted-foreground">
                No needs yet. Companies describe whom they need in the company view.
              </p>
              <Button nativeButton={false} render={<Link href="/company" />}>
                Open the company view <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        )}
        <div
          className={cn(
            "grid gap-6 lg:grid-cols-[320px_1fr]",
            (!needs.length || view !== "need") && "hidden",
          )}
        >
          {/* Need list */}
          <div className="space-y-2">
            <p className="px-1 text-xs font-medium text-muted-foreground">
              Needs from {new Set(needs.map((n) => n.company)).size} companies
            </p>
            {needs.map((n) => {
              const { suggested } = reviewList(n, talent);
              const open = suggested.filter((m) => !decisions[pairKey(m.needId, m.talentId)]).length;
              const asks = talent.filter((t) => {
                const k = pairKey(n.id, t.id);
                return optIns[k]?.talent === true && !decisions[k];
              }).length;
              const companyAsks = talent.filter((t) => {
                const k = pairKey(n.id, t.id);
                return optIns[k]?.company === true && !decisions[k];
              }).length;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setSelected(n.id);
                    setShowOthers(false);
                  }}
                  aria-current={need?.id === n.id}
                  className={cn(
                    "w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50",
                    need?.id === n.id && "border-primary ring-2 ring-primary/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{n.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.company}</p>
                    </div>
                    {n.createdByUser && <Badge>New</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                    {suggested.length} suggested · {open ? `${open} to review` : "all reviewed"} · sent{" "}
                    {n.submittedWeeksBefore} wk before
                  </p>
                  {asks > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary tabular-nums">
                      <HandIcon className="size-3.5" /> {asks} {asks === 1 ? "candidate" : "candidates"} asked
                      to meet
                    </p>
                  )}
                  {companyAsks > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary tabular-nums">
                      <Building2Icon className="size-3.5" /> Company asked about {companyAsks}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Review list */}
          {need && list && (
            <div className="space-y-4">
              <NeedSummary need={need} />
              <SkillLegend />

              <div className="space-y-1">
                <h2 className="text-sm font-medium">Suggested for review ({list.suggested.length})</h2>
                <p className="text-xs text-muted-foreground">
                  At least {Math.round(SUGGEST_THRESHOLD * 100)}% skill match, best first. A suggestion only.
                </p>
              </div>
              {list.suggested.length === 0 && (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    No one reaches the suggestion line for this need yet. Look through the people below
                    yourself, or suggest the company moves a rare must-have skill to nice-to-have.
                  </CardContent>
                </Card>
              )}
              {list.suggested.length > 1 && <RankToggle ranking={ranking} />}
              {ranking.ordered.map(card)}

              {list.notSuggested.length > 0 && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowOthers((v) => !v)}
                    aria-expanded={showOthers}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-3 text-left hover:bg-muted/40"
                  >
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">
                        Everyone else at the event ({list.notSuggested.length})
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Below the suggestion line. Not rejected: open any of them and decide yourself.
                      </span>
                    </span>
                    <ChevronDownIcon
                      className={cn("size-4 shrink-0 transition-transform", showOthers && "rotate-180")}
                    />
                  </button>
                  {showOthers && list.notSuggested.map(card)}
                </div>
              )}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="pipeline">
        <IntroductionsTable
          rows={introductions.map(({ key, d, need: n, t }) => ({
            key,
            d,
            need: n!,
            name: displayName(t) ?? t!.alias,
            o: optIns[key],
            status: pipeline(key),
          }))}
        />
      </TabsContent>

      <TabsContent value="log">
        <AuditLog
          entries={audit}
          needName={(id) => {
            const n = needs.find((x) => x.id === id);
            return n ? `${n.title} · ${n.company}` : id;
          }}
          alias={(id) => displayName(talentById.get(id)) ?? id}
          onExport={exportCsv}
        />
      </TabsContent>

      <DecisionDialog
        key={dialog ? `${dialog.type}:${dialog.m.needId}:${dialog.m.talentId}` : "closed"}
        state={dialog}
        onClose={() => setDialog(null)}
        onConfirm={confirm}
      />
    </Tabs>
  );
}

function NeedSummary({ need }: { need: Need }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {need.company} · {need.companyBlurb}
        </CardDescription>
        <CardTitle className="text-lg">{need.title}</CardTitle>
        <div className="col-start-2 row-span-2 row-start-1 flex items-center gap-1.5 self-start justify-self-end text-xs text-muted-foreground">
          <LanguagesIcon className="size-3.5" /> {need.language}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{need.summary}</p>
        {need.timing && (
          <p className="text-xs text-muted-foreground">
            Starts {need.timing.start} · {need.timing.engagement} · {need.mode}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {need.must.map((s) => (
            <SkillChip key={s} id={s} must className="border-primary/30 bg-accent text-accent-foreground" />
          ))}
          {need.nice.map((s) => (
            <SkillChip key={s} id={s} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MatchCard({
  need,
  m,
  t,
  decision: d,
  status,
  asked,
  companyAsked,
  companies,
  fit,
  onAction,
  onOtherCompany,
}: {
  need: Need;
  m: MatchExplanation;
  t: ReturnType<typeof useDemo>["talent"][number];
  decision?: Decision;
  status?: string;
  /** The candidate asked to meet for this need (from Explore roles). Not part of the score. */
  asked?: boolean;
  /** The company asked the organiser to introduce this person (from Find candidates). Not part of the score. */
  companyAsked?: boolean;
  /** Every company ranked for this person, best first. */
  companies: CompanyScore[];
  fit?: ReturnType<ReturnType<typeof useAiRanking>["fitOf"]>;
  onAction: (type: DialogType) => void;
  /** Open this person in "By candidate" to introduce them to a different company. */
  onOtherCompany: () => void;
}) {
  return (
    <Card className={cn(d?.status === "rejected" && "opacity-70")}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Avatar>
            <AvatarFallback>{initials(displayName(t) ?? t.alias)}</AvatarFallback>
          </Avatar>
          {displayName(t)}
          {t.createdByUser && <Badge>You</Badge>}
          {asked && (
            <Badge
              className="bg-primary text-primary-foreground"
              title="They asked to meet this company about this role. It doesn't change the skill match."
            >
              <HandIcon data-icon="inline-start" /> Candidate asked to meet
            </Badge>
          )}
          {companyAsked && (
            <Badge
              className="bg-primary text-primary-foreground"
              title="The company asked you to introduce this person. It doesn't change the skill match."
            >
              <Building2Icon data-icon="inline-start" /> Company asked for an introduction
            </Badge>
          )}
          {!m.suggested && (
            <Badge variant="outline" className="font-normal">
              below the line, not rejected
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="pl-10">{t.headline}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(() => {
          const i = companies.findIndex((c) => c.id === (need.companyId ?? "C-YOU"));
          return (
            <MatchPanel
              score={m.score}
              role={need.title}
              company={
                i < 0
                  ? undefined
                  : {
                      name: companies[i].name,
                      score: companies[i].score,
                      rank: i + 1,
                      total: companies.length,
                    }
              }
              companies={companies}
              currentId={companies[i]?.id}
            />
          );
        })()}
        <AiFitBadge fit={fit} />
        {t.contact && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Contact details">
            <li className="flex items-center gap-1.5 text-muted-foreground">
              <MapPinIcon className="size-3.5" /> {t.contact.city}
            </li>
            <li>
              <a
                href={`mailto:${t.contact.email}`}
                className="flex items-center gap-1.5 underline-offset-4 hover:underline"
              >
                <MailIcon className="size-3.5 text-muted-foreground" /> {t.contact.email}
              </a>
            </li>
            <li>
              <a
                href={`tel:${t.contact.phone.replace(/\s+/g, "")}`}
                className="flex items-center gap-1.5 tabular-nums underline-offset-4 hover:underline"
              >
                <PhoneIcon className="size-3.5 text-muted-foreground" /> {t.contact.phone}
              </a>
            </li>
          </ul>
        )}
        <MatchExplanationView m={m} />
        <WhyThisMatch need={need} talent={t} />
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
            More about this candidate
          </summary>
          <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <div>
              <dt className="inline text-muted-foreground">Background: </dt>
              <dd className="inline">{t.previousField}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Languages: </dt>
              <dd className="inline">
                {t.languages.map((l) => `${l.lang} (${l.level.toLowerCase()})`).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Prefers: </dt>
              <dd className="inline">{t.mode}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Available: </dt>
              <dd className="inline">{t.availability}</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-muted-foreground">
            This is context for the introduction. None of it is part of the match percentage.
          </p>
        </details>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {d ? (
          <>
            <Badge
              variant={d.status === "approved" ? "default" : "secondary"}
              className={cn(d.status === "approved" && "bg-evidence text-white")}
            >
              {d.status === "approved" ? (
                <CheckIcon data-icon="inline-start" />
              ) : (
                <XIcon data-icon="inline-start" />
              )}
              {d.status === "approved" ? "Introduced" : "Not now"} · {d.reason}
            </Badge>
            {status && <span className="text-xs text-muted-foreground">{status}</span>}
            {d.note && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquareIcon className="size-3" /> {d.note}
              </span>
            )}
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" onClick={() => onAction("edit")}>
                <PencilIcon data-icon="inline-start" /> Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onAction("revert")}>
                <Undo2Icon data-icon="inline-start" /> Undo
              </Button>
            </span>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => onAction("approve")}>
              <CheckIcon data-icon="inline-start" /> Introduce
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction("reject")}>
              <XIcon data-icon="inline-start" /> Not now
            </Button>
            <Button size="sm" variant="ghost" onClick={onOtherCompany}>
              <Building2Icon data-icon="inline-start" /> Other company…
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">Suggestion only · you decide</span>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

const DIALOG_COPY: Record<DialogType, { title: string; body: string; cta: string }> = {
  approve: {
    title: "Introduce this candidate to the company?",
    body: "The company sees the candidate in its Introductions view, and the candidate sees the role in their Meetings view. Each answers yes or no; a slot can be booked once both say yes.",
    cta: "Introduce with reason",
  },
  reject: {
    title: "Not now for this need?",
    body: "Passing needs a reason so decisions can be checked for bias. The candidate can still be introduced for other needs and is not told.",
    cta: "Pass with reason",
  },
  edit: {
    title: "Edit this decision",
    body: "Change the outcome, reason or note. The original decision stays in the audit log.",
    cta: "Save change",
  },
  revert: {
    title: "Undo this decision?",
    body: "The pair goes back to the review list and drops out of both sides' views. The withdrawal is logged; nothing is erased.",
    cta: "Undo decision",
  },
};

function DecisionDialog({
  state,
  onClose,
  onConfirm,
}: {
  state: DialogState | null;
  onClose: () => void;
  onConfirm: (reason: string, note: string, status?: Decision["status"]) => void;
}) {
  const type = state?.type ?? "approve";
  const [status, setStatus] = useState<Decision["status"]>(
    state?.current?.status === "approved" ? "rejected" : "approved",
  );
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(type === "edit" ? (state?.current?.note ?? "") : "");
  const [tried, setTried] = useState(false);
  const error = reasonError(reason, note);
  const copy = DIALOG_COPY[type];
  // Editing to a new outcome uses that outcome's reasons, so the log explains the new state.
  const options =
    type === "edit"
      ? [...REASONS[status === "approved" ? "approve" : "reject"], ...REASONS.edit]
      : reasonsFor(type);

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>

        {type === "edit" && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Outcome</p>
            <div className="flex gap-1.5">
              {(["approved", "rejected"] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={status === s ? "default" : "outline"}
                  aria-pressed={status === s}
                  onClick={() => {
                    setStatus(s);
                    setReason("");
                  }}
                >
                  {s === "approved" ? "Introduced" : "Not now"}
                  {state?.current?.status === s && " (current)"}
                </Button>
              ))}
            </div>
          </div>
        )}

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Reason (required, logged)</legend>
          {[...options, OTHER].map((r) => (
            <label
              key={r}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                reason === r && "border-primary bg-accent",
              )}
            >
              <input
                type="radio"
                name="reason"
                className="accent-(--primary)"
                checked={reason === r}
                onChange={() => setReason(r)}
              />
              {r}
            </label>
          ))}
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="note">
            Note {type === "approve" ? "for the company" : "(internal)"}
            {reason === OTHER ? " (required)" : " (optional)"}
          </Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={type === "approve" ? "e.g. Ask about their battery-domain interest." : ""}
          />
        </div>
        {tried && error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={
              type === "reject" || (type === "edit" && status === "rejected") ? "destructive" : "default"
            }
            onClick={() => {
              setTried(true);
              if (!error) onConfirm(reason, note, type === "edit" ? status : undefined);
            }}
          >
            {copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditLog({
  entries,
  needName,
  alias,
  onExport,
}: {
  entries: AuditEntry[];
  needName: (id: string) => string;
  alias: (id: string) => string;
  onExport: () => void;
}) {
  const rows = [...entries].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardListIcon className="size-4" /> Decisions log
        </CardTitle>
        <CardDescription>
          Every introduction, pass, edit and undo, with when and why. Append-only: entries are never changed
          or deleted.
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 flex flex-wrap gap-2 self-start justify-self-end">
          <Button size="sm" variant="outline" onClick={onExport} disabled={!entries.length}>
            <DownloadIcon data-icon="inline-start" /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href="/organiser/insights" />}
          >
            <HandshakeIcon data-icon="inline-start" /> Insights <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Need</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Reason / note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  No decisions yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground tabular-nums">{fmtTime(e.at)}</TableCell>
                <TableCell className="text-muted-foreground">{e.actor}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("font-normal", ACTION_STYLE[e.action])}>
                    {e.action}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-48 truncate">{needName(e.needId)}</TableCell>
                <TableCell>{alias(e.talentId)}</TableCell>
                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                  {e.from} → {e.to}
                </TableCell>
                <TableCell
                  className="max-w-72 truncate text-muted-foreground"
                  title={[e.reason, e.note].filter(Boolean).join(" — ")}
                >
                  {[e.reason, e.note].filter(Boolean).join(" — ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function IntroductionsTable({
  rows,
}: {
  rows: { key: string; d: Decision; need: Need; name: string; o?: OptInRow; status: string }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <NetworkIcon className="size-4" /> All introductions
        </CardTitle>
        <CardDescription>
          Every introduction you made, newest first, and where it stands. The company and the candidate answer
          in their own views; you only see whether they said yes, never a reason for a no.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Introduced</TableHead>
              <TableHead>Need</TableHead>
              <TableHead>Candidate</TableHead>
              <TableHead>Company&apos;s answer</TableHead>
              <TableHead>Candidate&apos;s answer</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  No introductions yet. Introduce people from the Suitable candidates tab.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="text-muted-foreground tabular-nums">{fmtTime(r.d.at)}</TableCell>
                <TableCell className="max-w-56 truncate" title={`${r.need.title} · ${r.need.company}`}>
                  {r.need.title} <span className="text-muted-foreground">· {r.need.company}</span>
                </TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>
                  <AnswerBadge value={r.o?.company} />
                </TableCell>
                <TableCell>
                  <AnswerBadge value={r.o?.talent} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AnswerBadge({ value }: { value?: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        value === true && "border-evidence/30 bg-evidence-soft text-evidence",
        value === undefined && "border-dashed text-muted-foreground",
      )}
    >
      {answerLabel(value)}
    </Badge>
  );
}

/**
 * The other way round: pick a candidate and see every company ranked for them (best role
 * first, same skills-only match), then introduce them to a role or pass, with a reason.
 */
function ByCandidate({
  needs,
  talent,
  decisions,
  optIns,
  selected,
  onSelect,
  onAction,
}: {
  needs: Need[];
  talent: Talent[];
  decisions: Record<string, Decision>;
  optIns: Record<string, OptInRow>;
  selected: string;
  onSelect: (talentId: string) => void;
  onAction: (type: DialogType, m: MatchExplanation) => void;
}) {
  const [query, setQuery] = useState("");
  const people = useMemo(
    () =>
      talent
        .map((t) => ({ t, companies: companiesFor(needs, t) }))
        .sort(
          (a, b) =>
            (b.companies[0]?.best.m.score ?? 0) - (a.companies[0]?.best.m.score ?? 0) ||
            (displayName(a.t) ?? a.t.alias).localeCompare(displayName(b.t) ?? b.t.alias),
        ),
    [needs, talent],
  );
  const q = query.trim().toLowerCase();
  const shown = q
    ? people.filter(({ t }) => `${displayName(t) ?? ""} ${t.alias} ${t.headline}`.toLowerCase().includes(q))
    : people;
  const current = people.find((p) => p.t.id === selected) ?? people[0];

  if (!current)
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">No candidates yet.</CardContent>
      </Card>
    );
  const t = current.t;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidates"
            aria-label="Search candidates"
            className="pl-8"
          />
        </div>
        <p className="px-1 text-xs font-medium text-muted-foreground">
          {people.length} candidates, best company match first
        </p>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {shown.map(({ t: p, companies }) => {
            const top = companies[0];
            const strong = companies.reduce((n, c) => n + c.strong, 0);
            const asks = needs.filter((n) => {
              const k = pairKey(n.id, p.id);
              return optIns[k]?.talent === true && !decisions[k];
            }).length;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                aria-current={current.t.id === p.id}
                className={cn(
                  "w-full rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50",
                  current.t.id === p.id && "border-primary ring-2 ring-primary/20",
                )}
              >
                <p className="truncate text-sm font-medium">{displayName(p) ?? p.alias}</p>
                <p className="truncate text-xs text-muted-foreground">{p.headline}</p>
                {top && (
                  <p className="mt-2 truncate text-xs text-muted-foreground tabular-nums">
                    Best: {top.best.need.company} · {Math.round(top.best.m.score * 100)}% · {strong} strong{" "}
                    {strong === 1 ? "fit" : "fits"}
                  </p>
                )}
                {asks > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary tabular-nums">
                    <HandIcon className="size-3.5" /> Asked to meet {asks}{" "}
                    {asks === 1 ? "company" : "companies"}
                  </p>
                )}
              </button>
            );
          })}
          {shown.length === 0 && (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">Nobody matches that search.</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <Avatar>
                <AvatarFallback>{initials(displayName(t) ?? t.alias)}</AvatarFallback>
              </Avatar>
              {displayName(t) ?? t.alias}
              {t.createdByUser && <Badge>New</Badge>}
            </CardTitle>
            <CardDescription className="pl-10">{t.headline}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {t.contact && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Contact details">
                <li className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPinIcon className="size-3.5" /> {t.contact.city}
                </li>
                <li className="flex items-center gap-1.5">
                  <MailIcon className="size-3.5 text-muted-foreground" /> {t.contact.email}
                </li>
              </ul>
            )}
            <div className="flex flex-wrap gap-1.5">
              {t.skills.map((s) => (
                <SkillChip key={s.id} id={s.id} kind={s.level} />
              ))}
            </div>
          </CardContent>
        </Card>

        <IntroduceTo
          key={t.id}
          name={displayName(t) ?? t.alias}
          companies={current.companies}
          decisions={decisions}
          talentId={t.id}
          onIntroduce={(m) => onAction("approve", m)}
        />

        <div className="space-y-1">
          <h2 className="text-sm font-medium">Companies ranked for this candidate</h2>
          <p className="text-xs text-muted-foreground">
            Each company by its best role for this person&apos;s skills, then by how many roles are strong
            fits. Below the line is not rejected: you can introduce anyone.
          </p>
        </div>
        <CompanyRanking
          companies={current.companies}
          renderRole={(need, m) => {
            const key = pairKey(need.id, t.id);
            const d = decisions[key];
            const o = optIns[key];
            if (d)
              return (
                <>
                  <Badge
                    variant={d.status === "approved" ? "default" : "secondary"}
                    className={cn("font-normal", d.status === "approved" && "bg-evidence text-white")}
                    title={d.reason}
                  >
                    {d.status === "approved" ? "Introduced" : "Not now"}
                  </Badge>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => onAction("edit", m)}
                    aria-label="Edit decision"
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => onAction("revert", m)}
                    aria-label="Undo decision"
                  >
                    <Undo2Icon />
                  </Button>
                </>
              );
            return (
              <>
                {o?.talent === true && (
                  <HandIcon className="size-3.5 text-primary" aria-label="Candidate asked to meet" />
                )}
                {o?.company === true && (
                  <Building2Icon
                    className="size-3.5 text-primary"
                    aria-label="Company asked for an introduction"
                  />
                )}
                <Button size="xs" onClick={() => onAction("approve", m)}>
                  <CheckIcon data-icon="inline-start" /> Introduce
                </Button>
                <Button size="xs" variant="outline" onClick={() => onAction("reject", m)}>
                  Not now
                </Button>
              </>
            );
          }}
        />
      </div>
    </div>
  );
}

/**
 * Pick any company, and which of its roles, to introduce this person to. Companies are
 * listed in skill-match order with their percentage; roles already decided can't be picked
 * again here (edit or undo them in the list below). Opens the same reason dialog.
 */
function IntroduceTo({
  name,
  talentId,
  companies,
  decisions,
  onIntroduce,
}: {
  name: string;
  talentId: string;
  companies: ReturnType<typeof companiesFor<Need>>;
  decisions: Record<string, Decision>;
  onIntroduce: (m: MatchExplanation) => void;
}) {
  const open = companies.flatMap((c) => c.roles).filter((r) => !decisions[pairKey(r.need.id, talentId)]);
  const [needId, setNeedId] = useState(open[0]?.need.id ?? "");
  const picked = open.find((r) => r.need.id === needId) ?? open[0];
  const decided = (id: string) => decisions[pairKey(id, talentId)];

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HandshakeIcon className="size-4 text-primary" /> Introduce {name} to a company
        </CardTitle>
        <CardDescription>
          Choose any company and role, best skill match first. The company and {name} then each say yes or no.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {open.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor={`introduce-${talentId}`} className="sr-only">
              Company and role
            </Label>
            <select
              id={`introduce-${talentId}`}
              value={picked?.need.id ?? ""}
              onChange={(e) => setNeedId(e.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            >
              {companies.map((c, i) => (
                <optgroup
                  key={c.companyId}
                  label={`${i + 1}. ${c.best.need.company} · ${Math.round(c.best.m.score * 100)}% company match`}
                >
                  {c.roles.map(({ need, m }) => {
                    const d = decided(need.id);
                    return (
                      <option key={need.id} value={need.id} disabled={!!d}>
                        {need.title} · {Math.round(m.score * 100)}%
                        {d
                          ? d.status === "approved"
                            ? " · introduced"
                            : " · not now"
                          : m.suggested
                            ? ""
                            : " · below the line"}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>
            <Button onClick={() => picked && onIntroduce(picked.m)} disabled={!picked}>
              <CheckIcon data-icon="inline-start" /> Introduce
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Every role at this event already has a decision for {name}. Edit or undo one below.
          </p>
        )}
        {picked && (
          <p className="mt-2 text-xs text-muted-foreground">
            {picked.need.company} · {picked.need.title}: {Math.round(picked.m.score * 100)}% skill match
            {picked.m.suggested ? "" : ", below the suggestion line (not rejected, your call)"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
