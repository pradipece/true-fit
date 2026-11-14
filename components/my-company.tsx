"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, EyeIcon, SparklesIcon, Undo2Icon, UsersIcon } from "lucide-react";
import { AiFitBadge, RankToggle, useAiRanking } from "@/components/ai-rank";
import { CandidateProfile } from "@/components/candidate-profile";
import { CompanyIntake, companyFit, IntroRequest, needToDraft } from "@/components/company-intake";
import { JobMeta } from "@/components/job-listing";
import { useSession } from "@/components/session";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { explainMatch, matchesForNeed, pairKey } from "@/lib/match";
import { stageOf } from "@/lib/pipeline";
import { companyOf } from "@/lib/schedule";
import { SEED_NEEDS } from "@/lib/seed";
import { useDemo } from "@/lib/store";
import type { NeedDraft } from "@/lib/intake";
import type { Need } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Find candidates: a company with its own account describes roles in the intake chat; a
 * demo company (synthetic seed) sees its roles view-only, so people trying the demo never
 * change the information everyone else sees. The server enforces the same rule. Both get the
 * TrueFit Assistant chat; for a demo company it refines the selected role (never saved) and
 * the suitable candidates follow the chat's version of it.
 */
export function MyCompany() {
  const { session } = useSession();
  const id = session?.role === "company" ? session.id : undefined;
  const isDemo = !!id && SEED_NEEDS.some((n) => companyOf(n) === id);
  return isDemo ? <DemoCompanyView companyId={id!} /> : <CompanyIntake />;
}

function DemoCompanyView({ companyId }: { companyId: string }) {
  const { needs, talent, decisions, optIns, slots, screening, offers, setOptIn } = useDemo();
  const roles = useMemo(() => needs.filter((n) => companyOf(n) === companyId), [needs, companyId]);
  const [selected, setSelected] = useState(roles[0]?.id ?? "");
  const saved = roles.find((n) => n.id === selected) ?? roles[0];
  // The chat's version of the selected role. Same id, so introductions stay on the real role.
  const [chat, setChat] = useState<{ id: string; draft: NeedDraft } | null>(null);
  const [resets, setResets] = useState(0);
  const savedId = saved?.id;
  const onDraft = useCallback((draft: NeedDraft) => savedId && setChat({ id: savedId, draft }), [savedId]);
  const need = useMemo(
    () => (saved ? withDraft(saved, chat?.id === saved.id ? chat.draft : undefined) : undefined),
    [saved, chat],
  );
  const refined = !!saved && !!need && need !== saved;
  const suitable = useMemo(
    () => (need ? matchesForNeed(need, talent).filter((m) => m.suggested) : []),
    [need, talent],
  );
  const byId = useMemo(() => new Map(talent.map((t) => [t.id, t])), [talent]);
  const ranking = useAiRanking(need, suitable, byId);
  if (!need) return <CompanyIntake preview />;
  const others = roles.filter((n) => n.id !== need.id);

  return (
    <div className="space-y-6">
      {/* The company's roles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setSelected(n.id)}
            aria-pressed={n.id === need.id}
            className={cn(
              "rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50",
              n.id === need.id && "border-primary ring-1 ring-primary",
            )}
          >
            <p className="font-medium">{n.title}</p>
            <JobMeta need={n} className="mt-1" />
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            {refined ? (
              <>
                <Badge variant="outline" className="border-primary/30 bg-accent text-accent-foreground">
                  <SparklesIcon data-icon="inline-start" /> Changed in the chat · not saved
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setChat(null);
                    setResets((r) => r + 1);
                  }}
                >
                  <Undo2Icon data-icon="inline-start" /> Back to the saved role
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="w-fit">
                <EyeIcon data-icon="inline-start" /> View-only role · refine it in the chat (bottom-right)
              </Badge>
            )}
          </div>
          <CardTitle>{need.title}</CardTitle>
          <CardDescription>{need.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-xs text-muted-foreground">Must have</p>
          <div className="flex flex-wrap gap-1.5">
            {need.must.map((s) => (
              <SkillChip key={s} id={s} must />
            ))}
          </div>
          {need.nice.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">Nice to have</p>
              <div className="flex flex-wrap gap-1.5">
                {need.nice.map((s) => (
                  <SkillChip key={s} id={s} />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4" aria-labelledby="demo-suitable">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="demo-suitable" className="flex items-center gap-2 text-lg font-semibold">
            <UsersIcon className="size-5 text-primary" /> Suitable candidates for {need.title}
          </h2>
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/meetings/company" />}>
            Candidates from Espoo <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
        {suitable.length ? (
          <>
            <RankToggle ranking={ranking} />
            <SkillLegend />
            <div className="flex flex-col gap-4">
              {ranking.ordered.map((m) => {
                const t = byId.get(m.talentId);
                if (!t) return null;
                const key = pairKey(need.id, t.id);
                return (
                  <CandidateProfile
                    key={t.id}
                    t={t}
                    m={m}
                    role={need.title}
                    company={companyFit(needs, t, companyId)}
                    otherRoles={others.map((n) => {
                      const o = explainMatch(n, t);
                      return { id: n.id, title: n.title, score: o.score, suggested: o.suggested };
                    })}
                    note={<AiFitBadge fit={ranking.fitOf(t.id)} />}
                    footer={
                      <IntroRequest
                        pair={key}
                        stage={stageOf(key, { decisions, optIns, slots, screening, offers })}
                        asked={optIns[key]?.company === true}
                        onAsk={(v) => setOptIn(key, "company", v)}
                      />
                    }
                  />
                );
              })}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nobody registered fits this role&apos;s must-have skills yet.
            </CardContent>
          </Card>
        )}
      </section>

      {/* TrueFit Assistant refines the selected role; the list above follows it. Never saved. */}
      <CompanyIntake key={`${need.id}:${resets}`} preview chatOnly base={saved} onDraft={onDraft} />
    </div>
  );
}

/** The saved role with the chat's changes applied, or the saved role itself if nothing changed. */
function withDraft(saved: Need, d: NeedDraft | undefined): Need {
  if (!d || JSON.stringify(d) === JSON.stringify(needToDraft(saved))) return saved;
  return {
    ...saved,
    title: d.title || saved.title,
    occupation: d.occupation || saved.occupation,
    summary: d.summary || saved.summary,
    must: d.must,
    nice: d.nice,
    language: d.language || saved.language,
    mode: d.mode || saved.mode,
    timing: d.timing.start
      ? { start: d.timing.start, engagement: d.timing.engagement || saved.timing?.engagement || "Permanent" }
      : saved.timing,
  };
}
