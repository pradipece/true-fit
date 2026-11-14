"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardListIcon,
  DownloadIcon,
  HandshakeIcon,
  LanguagesIcon,
  ListChecksIcon,
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
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { IdentitySwitch, useIdentity } from "@/components/identity";
import { MatchExplanationView, ScoreMeter } from "@/components/match-explanation";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { WhyThisMatch } from "@/components/why-this-match";
import { pairKey, SUGGEST_THRESHOLD } from "@/lib/match";
import { auditCsv, OTHER, REASONS, reasonError, reviewList } from "@/lib/oversight";
import { companyOf } from "@/lib/schedule";
import { useDemo } from "@/lib/store";
import type { AuditEntry, Decision, MatchExplanation, Need, Talent } from "@/lib/types";
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

/**
 * The company reviews the people suggested for its own needs and decides, with a reason,
 * whom to invite. Matching only suggests; nothing is automatic and every decision is logged.
 * Only the signed-in company's needs, decisions and audit entries are shown.
 */
export function CandidateReview() {
  const {
    needs: allNeeds,
    talent,
    decisions,
    audit: allAudit,
    optIns,
    slots,
    feedback,
    decide,
    undoDecision,
    setOptIn,
  } = useDemo();
  const { id: companyId } = useIdentity("company");
  const needs = useMemo(() => allNeeds.filter((n) => companyOf(n) === companyId), [allNeeds, companyId]);
  const audit = useMemo(() => {
    const own = new Set(needs.map((n) => n.id));
    return allAudit.filter((e) => own.has(e.needId));
  }, [allAudit, needs]);
  const [selected, setSelected] = useState<string>(needs[0]?.id ?? "");
  const [showOthers, setShowOthers] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const need = needs.find((n) => n.id === selected) ?? needs[0];
  const list = useMemo(() => (need ? reviewList(need, talent) : null), [need, talent]);
  const talentById = useMemo(() => new Map(talent.map((t) => [t.id, t])), [talent]);
  const [tab, setTab] = useState<"review" | "log">("review");
  const awaitingReview = needs.reduce(
    (sum, n) =>
      sum + reviewList(n, talent).suggested.filter((m) => !decisions[pairKey(m.needId, m.talentId)]).length,
    0,
  );

  const pipeline = (key: string) =>
    feedback[key]?.company && feedback[key]?.talent
      ? "Feedback from both sides"
      : feedback[key]?.company || feedback[key]?.talent
        ? "Feedback from one side"
        : slots[key]
          ? `Meeting at ${slots[key]}`
          : optIns[key]?.company && optIns[key]?.talent
            ? "Both opted in"
            : optIns[key]?.company
              ? "Invited, waiting for the candidate"
              : "Waiting for your yes in Meetings";

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
      // Inviting is the company's yes; the candidate answers in their Meetings view.
      if (next === "approved" && optIns[key]?.company === undefined) setOptIn(key, "company", true);
      toast.success(
        dialog.type === "edit"
          ? `Decision changed to ${next === "approved" ? "invited" : "not now"}`
          : next === "approved"
            ? "Invited to meet"
            : "Passed for this need, with reason logged",
        {
          description:
            next === "approved"
              ? "The candidate sees the invitation in their Meetings view and answers yes or no."
              : "The candidate can still be matched to other needs.",
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
      <IdentitySwitch side="company" />
      <TabsList className="h-10">
        <TabsTrigger value="review" className="px-3">
          <ListChecksIcon /> Suitable candidates
          {awaitingReview > 0 && (
            <Badge className="ml-1 h-5 min-w-5 px-1.5 tabular-nums">{awaitingReview}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="log" className="px-3">
          <ClipboardListIcon /> Your decisions log
        </TabsTrigger>
      </TabsList>

      <TabsContent value="review" className="space-y-6">
        <p className="flex items-start gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <ScaleIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">You decide whom to invite.</span> Nobody is rejected
            automatically: people below the {Math.round(SUGGEST_THRESHOLD * 100)}% suggestion line are listed
            too. The order comes from skills only; there are no hidden scores, and every percentage is a skill
            match you can open. Names and contact details are fictional demo data.
          </span>
        </p>

        {needs.length === 0 && (
          <Card>
            <CardContent className="space-y-3 py-10 text-center">
              <p className="text-muted-foreground">
                No approved need card yet. Describe who you need and approve the card to see suitable
                candidates.
              </p>
              <Button nativeButton={false} render={<Link href="/company" />}>
                Write a need card <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        )}
        <div className={cn("grid gap-6 lg:grid-cols-[320px_1fr]", !needs.length && "hidden")}>
          {/* Need list */}
          <div className="space-y-2">
            <p className="px-1 text-xs font-medium text-muted-foreground">Your needs</p>
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
                  At least {Math.round(SUGGEST_THRESHOLD * 100)}% skill match, best first. A suggestion only.
                </p>
              </div>
              {list.suggested.length === 0 && (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    No one reaches the suggestion line for this need yet. Look through the people below
                    yourself, or move a rare must-have skill to nice-to-have on your card.
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
          <Avatar>
            <AvatarFallback>{initials(displayName(t) ?? t.alias)}</AvatarFallback>
          </Avatar>
          {displayName(t)}
          {t.createdByUser && <Badge>You</Badge>}
          {!m.suggested && (
            <Badge variant="outline" className="font-normal">
              below the line, not rejected
            </Badge>
          )}
        </CardTitle>
        <CardDescription className="pl-10">{t.headline}</CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <ScoreMeter score={m.score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
              {d.status === "approved" ? "Invited" : "Not now"} · {d.reason}
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
              <CheckIcon data-icon="inline-start" /> Invite to meet
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction("reject")}>
              <XIcon data-icon="inline-start" /> Not now
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
    title: "Invite this candidate to meet?",
    body: "The candidate sees your invitation and need card in their Meetings view and answers yes or no. You book a slot once they say yes.",
    cta: "Invite with reason",
  },
  reject: {
    title: "Not now for this need?",
    body: "Passing needs a reason so decisions can be checked for bias. The candidate can still be matched to other needs and is not told.",
    cta: "Pass with reason",
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
                  {s === "approved" ? "Invited" : "Not now"}
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
          <ClipboardListIcon className="size-4" /> Your decisions log
        </CardTitle>
        <CardDescription>
          Every invitation, pass, edit and undo for your needs, with when and why. Append-only: entries are
          never changed or deleted.
        </CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 flex flex-wrap gap-2 self-start justify-self-end">
          <Button size="sm" variant="outline" onClick={onExport} disabled={!entries.length}>
            <DownloadIcon data-icon="inline-start" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/meetings/company" />}>
            <HandshakeIcon data-icon="inline-start" /> Meetings <ArrowRightIcon data-icon="inline-end" />
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
