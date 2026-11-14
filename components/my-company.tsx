"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, EyeIcon, UsersIcon } from "lucide-react";
import { AiFitBadge, RankToggle, useAiRanking } from "@/components/ai-rank";
import { CandidateProfile } from "@/components/candidate-profile";
import { CompanyIntake, companyFit, IntroRequest } from "@/components/company-intake";
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
import { cn } from "@/lib/utils";

/**
 * Find candidates: a company with its own account describes roles in the intake chat; a
 * demo company (synthetic seed) sees its roles view-only, so people trying the demo never
 * change the information everyone else sees. The server enforces the same rule.
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
  const need = roles.find((n) => n.id === selected) ?? roles[0];
  const suitable = useMemo(
    () => (need ? matchesForNeed(need, talent).filter((m) => m.suggested) : []),
    [need, talent],
  );
  const byId = useMemo(() => new Map(talent.map((t) => [t.id, t])), [talent]);
  const ranking = useAiRanking(need, suitable, byId);
  if (!need) return null;
  const others = roles.filter((n) => n.id !== need.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-sm text-accent-foreground">
        <EyeIcon className="mt-0.5 size-4 shrink-0" />
        <p className="min-w-0 flex-1">
          <span className="font-medium">{need.company} is a demo company.</span> Its information and roles are
          view-only, so everyone trying the demo sees them unchanged. You can still review candidates, ask
          Espoo for introductions and interview them.
        </p>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/login?role=company" />}>
          Create my own company account
        </Button>
      </div>

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
          <Badge variant="outline" className="w-fit">
            <EyeIcon data-icon="inline-start" /> View-only role
          </Badge>
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
            <div className="grid gap-4 lg:grid-cols-2">
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
    </div>
  );
}
