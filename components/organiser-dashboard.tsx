"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  DownloadIcon,
  EyeOffIcon,
  HandshakeIcon,
  LanguagesIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MessageSquareIcon,
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
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MatchExplanationView, ScoreMeter } from "@/components/match-explanation";
import { OrganiserOverview } from "@/components/organiser-overview";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { WhyThisMatch } from "@/components/why-this-match";
import { pairKey, SUGGEST_THRESHOLD } from "@/lib/match";
import { auditCsv, OTHER, overview, REASONS, reasonError, reviewList } from "@/lib/oversight";
import { useDemo } from "@/lib/store";
import type { AuditEntry, Decision, MatchExplanation, Need } from "@/lib/types";
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

const ACTION_STYLE: Record<AuditEntry["action"], string> = {
  approved: "border-evidence/30 bg-evidence-soft text-evidence",
  rejected: "border-border bg-secondary text-secondary-foreground",
  edited: "border-transfer/30 bg-transfer-soft text-transfer",
  reverted: "border-dashed",
};

export function OrganiserDashboard() {
  const { needs, talent, decisions, audit, optIns, slots, feedback, decide, undoDecision } = useDemo();
  const [selected, setSelected] = useState<string>(needs[0]?.id ?? "");
  const [showOthers, setShowOthers] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const need = needs.find((n) => n.id === selected) ?? needs[0];
  const list = useMemo(() => (need ? reviewList(need, talent) : null), [need, talent]);
  const talentById = useMemo(() => new Map(talent.map((t) => [t.id, t])), [talent]);
  const [tab, setTab] = useState<"overview" | "review" | "log">("overview");
  const o = useMemo(
    () => overview(needs, talent, decisions, optIns, slots),
    [needs, talent, decisions, optIns, slots],
  );

  const openReview = (needId?: string) => {
    if (needId) setSelected(needId);
    setShowOthers(false);
    setTab("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pipeline = (key: string) =>
    feedback[key]
      ? "Feedback in"
      : slots[key]
        ? `Meeting at ${slots[key]}`
        : optIns[key]?.company && optIns[key]?.talent
          ? "Both opted in"
          : "Awaiting opt-in";

  const confirm = (reason: string, note: string, status?: Decision["status"]) => {
    if (!dialog) return;
    const key = pairKey(dialog.m.needId, dialog.m.talentId);
    const n = note.trim() || undefined;
    if (dialog.type === "revert") {
      undoDecision(key, reason);
      toast("Decision withdrawn", { description: "Back in your review list. Logged in the audit trail." });
    } else {
      const next = dialog.type === "edit" ? status! : dialog.type === "approve" ? "approved" : "rejected";
      decide(key, { status: next, reason, note: n });
      toast.success(
        dialog.type === "edit"
          ? `Decision changed to ${next}`
          : next === "approved"
            ? "Approved, both sides asked to opt in"
            : "Rejected for this need, with reason logged",
        {
          description:
            next === "approved"
              ? "Identities stay hidden until both say yes."
              : "The candidate stays in the pool for other needs.",
        },
      );
    }
    setDialog(null);
  };

  const exportCsv = () => {
    const blob = new Blob([auditCsv(audit, needs, talent)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "truefit-audit-log.csv" });
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
        onAction={(type) => setDialog({ type, m, current: d })}
      />
    );
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-6">
      <TabsList className="h-10">
        <TabsTrigger value="overview" className="px-3">
          <LayoutDashboardIcon /> Overview
        </TabsTrigger>
        <TabsTrigger value="review" className="px-3">
          <ListChecksIcon /> Review matches
          {o.awaitingReview > 0 && (
            <Badge className="ml-1 h-5 min-w-5 px-1.5 tabular-nums">{o.awaitingReview}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="log" className="px-3">
          <ClipboardListIcon /> Audit log
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OrganiserOverview onReview={openReview} />
      </TabsContent>

      <TabsContent value="review" className="space-y-6">
        <p className="flex items-start gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <ScaleIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">You decide every match.</span> Nobody is rejected
            automatically: people below the {Math.round(SUGGEST_THRESHOLD * 100)}% guide are listed too. There
            are no hidden scores: every percentage is skill overlap and opens to its full calculation.
          </span>
        </p>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Need list */}
          <div className="space-y-2">
            <p className="px-1 text-xs font-medium text-muted-foreground">Company needs</p>
            {needs.map((n) => {
              const { suggested } = reviewList(n, talent);
              const open = suggested.filter((m) => !decisions[pairKey(m.needId, m.talentId)]).length;
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
                  At least {Math.round(SUGGEST_THRESHOLD * 100)}% skill overlap, highest first. A suggestion
                  only.
                </p>
              </div>
              {list.suggested.length === 0 && (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    No one reaches the guide for this need yet. Review the people below yourself, or invite
                    talent with these skills.
                  </CardContent>
                </Card>
              )}
              {list.suggested.map(card)}

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
                        Everyone else in the pool ({list.notSuggested.length})
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Below the overlap guide. Not rejected: open any of them and decide yourself.
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

      <TabsContent value="log">
        <AuditLog
          entries={audit}
          needName={(id) => {
            const n = needs.find((x) => x.id === id);
            return n ? `${n.title} · ${n.company}` : id;
          }}
          alias={(id) => talentById.get(id)?.alias ?? id}
          onExport={exportCsv}
        />
      </TabsContent>

      <DecisionDialog
        key={dialog ? `${dialog.type}:${dialog.m.talentId}` : "closed"}
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
  onAction,
}: {
  need: Need;
  m: MatchExplanation;
  t: ReturnType<typeof useDemo>["talent"][number];
  decision?: Decision;
  status?: string;
  onAction: (type: DialogType) => void;
}) {
  return (
    <Card className={cn(d?.status === "rejected" && "opacity-70")}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="grid size-8 place-items-center rounded-full bg-secondary">
            <EyeOffIcon className="size-3.5 text-muted-foreground" />
          </span>
          {t.alias}
          {t.createdByUser && <Badge>You</Badge>}
          {!m.suggested && (
            <Badge variant="outline" className="font-normal">
              below guide, not rejected
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="pl-10">{t.headline}</CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <ScoreMeter score={m.score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
            This is context for you. None of it is part of the match percentage.
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
              {d.status === "approved" ? "Approved" : "Rejected"} · {d.reason}
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
              <CheckIcon data-icon="inline-start" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction("reject")}>
              <XIcon data-icon="inline-start" /> Reject
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
    title: "Approve this match?",
    body: "Both sides will be asked to opt in. Nothing is shared until they both agree.",
    cta: "Approve & request opt-in",
  },
  reject: {
    title: "Reject for this need?",
    body: "Rejections need a reason so they can be reviewed for bias. The candidate stays in the pool for other needs and is not told.",
    cta: "Reject with reason",
  },
  edit: {
    title: "Edit this decision",
    body: "Change the outcome, reason or note. The original decision stays in the audit log.",
    cta: "Save change",
  },
  revert: {
    title: "Undo this decision?",
    body: "The pair goes back to your review list. The withdrawal is logged; nothing is erased.",
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
                  {s === "approved" ? "Approved" : "Rejected"}
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
          <ClipboardListIcon className="size-4" /> Audit log
        </CardTitle>
        <CardDescription>
          Every approval, rejection, edit and undo, with who, when and why. Append-only: entries are never
          changed or deleted.
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 flex flex-wrap gap-2 self-start justify-self-end">
          <Button size="sm" variant="outline" onClick={onExport} disabled={!entries.length}>
            <DownloadIcon data-icon="inline-start" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/meetings" />}>
            <HandshakeIcon data-icon="inline-start" /> Opt-ins & slots{" "}
            <ArrowRightIcon data-icon="inline-end" />
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
