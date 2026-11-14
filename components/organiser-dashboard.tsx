"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CheckIcon,
  ClipboardListIcon,
  EyeOffIcon,
  HandshakeIcon,
  InboxIcon,
  LanguagesIcon,
  MessageSquareIcon,
  SparklesIcon,
  Undo2Icon,
  UsersIcon,
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { MatchExplanationView, ScoreMeter } from "@/components/match-explanation";
import { WhyThisMatch } from "@/components/why-this-match";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { matchesForNeed, pairKey, SUGGEST_THRESHOLD } from "@/lib/match";
import { useDemo } from "@/lib/store";
import type { MatchExplanation } from "@/lib/types";
import { cn } from "@/lib/utils";

const DISMISS_REASONS = [
  "Key must-have not evidenced",
  "Company asked for a different seniority",
  "Candidate's preferred mode doesn't fit",
  "Already meeting this company",
];

export function OrganiserDashboard() {
  const { needs, talent, decisions, optIns, slots, feedback, decide, undoDecision } = useDemo();
  const [selected, setSelected] = useState<string>(needs[0]?.id ?? "");
  const [showAll, setShowAll] = useState(false);
  const [dialog, setDialog] = useState<{ type: "approve" | "dismiss"; m: MatchExplanation } | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState(DISMISS_REASONS[0]);

  const need = needs.find((n) => n.id === selected) ?? needs[0];
  const matches = useMemo(() => (need ? matchesForNeed(need, talent) : []), [need, talent]);
  const visible = showAll ? matches : matches.filter((m) => m.suggested);
  const talentById = useMemo(() => new Map(talent.map((t) => [t.id, t])), [talent]);

  const suggestedTotal = useMemo(
    () => needs.reduce((acc, n) => acc + matchesForNeed(n, talent).filter((m) => m.suggested).length, 0),
    [needs, talent],
  );
  const approved = Object.values(decisions).filter((d) => d.status === "approved").length;
  const mutual = Object.values(optIns).filter((o) => o.company && o.talent).length;

  const stats = [
    {
      label: "Need cards",
      value: needs.length,
      icon: InboxIcon,
      hint: `${needs.filter((n) => n.submittedWeeksBefore >= 2).length} sent 2+ weeks early`,
    },
    { label: "Talent pool", value: talent.length, icon: UsersIcon, hint: "anonymised skill cards" },
    { label: "Suggested", value: suggestedTotal, icon: SparklesIcon, hint: "awaiting your review" },
    { label: "Approved by you", value: approved, icon: CheckIcon, hint: "sent for mutual opt-in" },
    {
      label: "Meetings booked",
      value: Object.keys(slots).length,
      icon: CalendarCheckIcon,
      hint: `${mutual} mutual opt-ins`,
    },
  ];

  const log = Object.entries(decisions).sort((a, b) => b[1].at.localeCompare(a[1].at));

  const confirm = () => {
    if (!dialog) return;
    const key = pairKey(dialog.m.needId, dialog.m.talentId);
    if (dialog.type === "approve") {
      decide(key, { status: "approved", note: note.trim() || undefined });
      toast.success("Approved, both sides asked to opt in", {
        description: "Identities stay hidden until both say yes.",
      });
    } else {
      decide(key, { status: "dismissed", reason, note: note.trim() || undefined });
      toast("Dismissed with reason logged");
    }
    setDialog(null);
    setNote("");
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs">{s.label}</span>
                <s.icon className="size-4" />
              </div>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="truncate text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Need list */}
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium text-muted-foreground">Company needs</p>
          {needs.map((n) => {
            const count = matchesForNeed(n, talent).filter((m) => m.suggested).length;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelected(n.id)}
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
                  {n.createdByUser ? (
                    <Badge>New</Badge>
                  ) : (
                    <Badge variant="secondary" className="tabular-nums">
                      {count}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Sent {n.submittedWeeksBefore} wk before · {n.mode}
                </p>
              </button>
            );
          })}
        </div>

        {/* Candidates */}
        {need && (
          <div className="space-y-4">
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
                    <SkillChip
                      key={s}
                      id={s}
                      must
                      className="border-primary/30 bg-accent text-accent-foreground"
                    />
                  ))}
                  {need.nice.map((s) => (
                    <SkillChip key={s} id={s} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <SkillLegend />
              <div className="flex items-center gap-2">
                <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
                <Label htmlFor="show-all" className="text-xs">
                  Show everyone ({matches.length}), not only suggestions
                </Label>
              </div>
            </div>

            {visible.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No one passes the {Math.round(SUGGEST_THRESHOLD * 100)}% overlap guide yet. Turn on “Show
                  everyone” to review the full pool yourself, or invite talent with these skills.
                </CardContent>
              </Card>
            )}

            {visible.map((m) => {
              const t = talentById.get(m.talentId)!;
              const key = pairKey(m.needId, m.talentId);
              const d = decisions[key];
              return (
                <Card key={key} className={cn(d?.status === "dismissed" && "opacity-60")}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="grid size-8 place-items-center rounded-full bg-secondary">
                        <EyeOffIcon className="size-3.5 text-muted-foreground" />
                      </span>
                      {t.alias}
                      {t.createdByUser && <Badge>You</Badge>}
                      {!m.suggested && (
                        <Badge variant="outline" className="font-normal">
                          below guide
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
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Background: {t.previousField}</span>
                      <span>
                        Languages: {t.languages.map((l) => `${l.lang} (${l.level.toLowerCase()})`).join(", ")}
                      </span>
                      <span>Prefers: {t.mode}</span>
                      <span>Available: {t.availability}</span>
                    </div>
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
                          {d.status === "approved" ? "Approved" : `Dismissed · ${d.reason}`}
                        </Badge>
                        {d.note && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquareIcon className="size-3" /> {d.note}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto"
                          onClick={() => undoDecision(key)}
                        >
                          <Undo2Icon data-icon="inline-start" /> Undo
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => setDialog({ type: "approve", m })}>
                          <CheckIcon data-icon="inline-start" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ type: "dismiss", m })}>
                          <XIcon data-icon="inline-start" /> Dismiss
                        </Button>
                        <span className="ml-auto text-xs text-muted-foreground">
                          Suggestion only · you decide
                        </span>
                      </>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Decision log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardListIcon className="size-4" /> Human decision log
          </CardTitle>
          <CardDescription>
            Every approval and dismissal, with who, when and why. Exportable for audits.
          </CardDescription>
          <Button
            size="sm"
            variant="outline"
            className="col-start-2 row-span-2 row-start-1 self-start justify-self-end"
            nativeButton={false}
            render={<Link href="/meetings" />}
          >
            <HandshakeIcon data-icon="inline-start" /> Opt-ins & slots{" "}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Need</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Reason / note</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No decisions yet.
                  </TableCell>
                </TableRow>
              )}
              {log.map(([key, d]) => {
                const [needId, talentId] = key.split("::");
                const n = needs.find((x) => x.id === needId);
                const o = optIns[key];
                return (
                  <TableRow key={key}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {new Date(d.at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>{n ? `${n.title} · ${n.company}` : needId}</TableCell>
                    <TableCell>{talentById.get(talentId)?.alias ?? talentId}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "approved" ? "outline" : "secondary"}>{d.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">
                      {[d.reason, d.note].filter(Boolean).join(" — ") || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {d.status === "dismissed"
                        ? "—"
                        : feedback[key]
                          ? "Feedback in"
                          : slots[key]
                            ? `Meeting ${slots[key]}`
                            : o?.company && o?.talent
                              ? "Both opted in"
                              : "Awaiting opt-in"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "approve" ? "Approve this match?" : "Dismiss this suggestion?"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.type === "approve"
                ? "Both sides will be asked to opt in. Nothing is shared until they both agree."
                : "Dismissals need a reason so they can be reviewed for bias later. The candidate stays in the pool."}
            </DialogDescription>
          </DialogHeader>
          {dialog?.type === "dismiss" && (
            <div className="grid gap-1.5">
              {DISMISS_REASONS.map((r) => (
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
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="note">Note for the company {dialog?.type === "dismiss" && "(internal)"}</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                dialog?.type === "approve" ? "e.g. Ask about their battery-domain interest." : "Optional"
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            <Button variant={dialog?.type === "dismiss" ? "destructive" : "default"} onClick={confirm}>
              {dialog?.type === "approve" ? "Approve & request opt-in" : "Dismiss with reason"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
