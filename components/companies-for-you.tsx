"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, Building2Icon, LoaderCircleIcon, SparklesIcon, TrophyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { explainMatch, type MatchTalent } from "@/lib/match";
import {
  companiesByFit,
  roleRankInput,
  rulesRoleRanking,
  type RoleIn,
  type RoleRankResult,
} from "@/lib/role-rank";
import { companyOf } from "@/lib/schedule";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 1200;

/**
 * Which companies suit the job seeker best, from their skill card as they build it: each
 * company by its best role, with the job title and an AI fit rate (highest first) next to
 * the plain skill match. Only the person's own skills and evidence and the public role
 * cards are sent; without AI the same list comes from the rules.
 */
export function CompaniesForYou({ talent }: { talent: MatchTalent }) {
  const { needs } = useDemo();
  const roles: RoleIn[] = useMemo(
    () =>
      needs
        .filter((n) => n.must.length)
        .map((n) => ({
          id: n.id,
          title: n.title,
          company: n.company,
          companyId: companyOf(n),
          must: n.must,
          nice: n.nice,
        })),
    [needs],
  );
  const key = JSON.stringify([
    talent.skills,
    talent.evidence.map((e) => [e.excerpt, e.skills]),
    roles.map((r) => [r.id, r.must, r.nice]),
  ]);
  const [ai, setAi] = useState<{ key: string; data: RoleRankResult } | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const skillScore = useMemo(() => {
    const scores = new Map(roles.map((r) => [r.id, explainMatch(r, talent).score]));
    return (id: string) => scores.get(id) ?? 0;
  }, [roles, talent]);
  const rules = useMemo(() => {
    if (!talent.skills.length || !roles.length) return [];
    const { input, needIds } = roleRankInput(roles, talent);
    return rulesRoleRanking(input, needIds);
  }, [roles, talent]);

  useEffect(() => {
    if (!talent.skills.length || !roles.length || ai?.key === key) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoadingKey(key);
      fetch("/api/talent/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ talent: { skills: talent.skills, evidence: talent.evidence }, roles }),
      })
        .then(async (r) => {
          const data = (await r.json().catch(() => ({}))) as Partial<RoleRankResult>;
          if (r.ok && Array.isArray(data.ranking)) setAi({ key, data: data as RoleRankResult });
        })
        .catch(() => {
          /* keep the rules order */
        })
        .finally(() => setLoadingKey((k) => (k === key ? null : k)));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `key` captures talent and roles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = ai?.key === key ? ai.data : null;
  const companies = companiesByFit(roles, current?.ranking ?? rules, skillScore);
  const loading = loadingKey === key && !current;
  const source = current?.source ?? "rules";

  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          <SparklesIcon className="size-3.5 text-primary" /> Based on your skills and the job titles here
        </CardDescription>
        <CardTitle className="flex items-center gap-2">Companies that suit you best</CardTitle>
        <Badge
          variant="outline"
          className="col-start-2 row-span-2 row-start-1 self-start justify-self-end font-normal"
        >
          {loading ? (
            <>
              <LoaderCircleIcon className="animate-spin" data-icon="inline-start" /> AI is ranking
            </>
          ) : source === "ai" ? (
            "AI fit rate"
          ) : (
            "Skill match"
          )}
        </Badge>
      </CardHeader>
      <CardContent>
        {!talent.skills.length ? (
          <p className="text-sm text-muted-foreground">
            Pick a few skills and the companies whose roles fit you best appear here, highest match first.
          </p>
        ) : (
          <ol className="space-y-3">
            {companies.map((c, i) => (
              <li key={c.companyId} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    i === 0 ? "bg-evidence text-white" : "bg-muted text-muted-foreground",
                  )}
                  aria-label={`Rank ${i + 1}`}
                >
                  {i === 0 ? <TrophyIcon className="size-3.5" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                      <Building2Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.company}</span>
                    </p>
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold tabular-nums",
                        c.best.fit >= 60
                          ? "text-evidence"
                          : c.best.fit >= 40
                            ? "text-primary"
                            : "text-muted-foreground",
                      )}
                    >
                      {c.best.fit}%
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.best.title}
                    {source === "ai" && <> · {c.best.skill}% skill match</>}
                    {c.roles.length > 1 && (
                      <>
                        {" "}
                        · +{c.roles.length - 1} more {c.roles.length === 2 ? "role" : "roles"}
                      </>
                    )}
                  </p>
                  {source === "ai" && c.best.reason && (
                    <p className="text-xs leading-snug">{c.best.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2">
        <p className="text-xs text-muted-foreground">
          {source === "ai"
            ? "AI fit rate: the skill match, adjusted for how well your answers show each role's skills. Advice for you only; only your skills and answers are used."
            : "Skill match from your skills only. Add answers that show your skills to raise it."}
        </p>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/talent/explore" />}>
          Explore every role <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}
