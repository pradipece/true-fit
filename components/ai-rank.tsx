"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircleIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RankedCandidate, RankResult } from "@/lib/match-rank";
import type { MatchExplanation, Need, Talent } from "@/lib/types";
import { cn } from "@/lib/utils";

export type RankMode = "skills" | "ai";

/**
 * Optional AI order for a list of matches. Off by default: the list stays in skill-match
 * order until the company switches to "AI fit rate". Only skills and evidence are sent.
 */
export function useAiRanking(
  need: Need | undefined,
  matches: MatchExplanation[],
  talent: Map<string, Talent>,
) {
  const [mode, setMode] = useState<RankMode>("skills");
  const [result, setResult] = useState<{ key: string; data: RankResult } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  // Re-rank whenever the need's skills or the matched people change.
  const key = need
    ? JSON.stringify([need.title, need.must, need.nice, matches.map((m) => [m.talentId, m.score])])
    : "";
  const active = mode === "ai" && !!need && matches.length > 0;

  useEffect(() => {
    if (!active || result?.key === key || error?.key === key) return;
    const ctrl = new AbortController();
    fetch("/api/match/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        need: { title: need!.title, must: need!.must, nice: need!.nice },
        talent: matches.flatMap((m) => {
          const t = talent.get(m.talentId);
          return t ? [{ id: t.id, skills: t.skills, evidence: t.evidence }] : [];
        }),
      }),
    })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as Partial<RankResult> & { error?: string };
        if (!r.ok || !Array.isArray(data.ranking)) throw new Error(data.error ?? "Ranking failed");
        setResult({ key, data: data as RankResult });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setError({ key, message: e instanceof Error ? e.message : "Ranking failed" });
      });
    return () => ctrl.abort();
    // `key` captures need and matches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);

  const data = result?.key === key ? result.data : null;
  const byId = useMemo(
    () =>
      new Map<string, RankedCandidate & { rank: number }>(
        data?.ranking.map((r, i) => [r.talentId, { ...r, rank: i + 1 }]),
      ),
    [data],
  );
  const ordered = useMemo(() => {
    if (!active || !data) return matches;
    return [...matches].sort(
      (a, b) => (byId.get(a.talentId)?.rank ?? 999) - (byId.get(b.talentId)?.rank ?? 999),
    );
  }, [active, data, matches, byId]);

  return {
    mode,
    setMode,
    ordered,
    fitOf: (talentId: string) => (active ? byId.get(talentId) : undefined),
    loading: active && !data && error?.key !== key,
    error: active && error?.key === key ? error.message : null,
    source: active ? data?.source : undefined,
  };
}

/** "Order by" switch shown above a candidate list. */
export function RankToggle({ ranking }: { ranking: ReturnType<typeof useAiRanking> }) {
  const { mode, setMode, loading, error, source } = ranking;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Order by</span>
        <div
          role="radiogroup"
          aria-label="Order candidates by"
          className="inline-flex rounded-lg border p-0.5"
        >
          {(
            [
              ["skills", "Skill match"],
              ["ai", "AI fit rate"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
                mode === value ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {value === "ai" && <SparklesIcon className="size-3" />} {label}
            </button>
          ))}
        </div>
        {loading && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <LoaderCircleIcon className="size-3 animate-spin" /> AI is reading the skill evidence…
          </span>
        )}
        {source === "rules" && (
          <span className="text-xs text-muted-foreground">AI unavailable: ordered by the rules version.</span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
      {mode === "ai" && (
        <p className="text-xs text-muted-foreground">
          A suggested order only. The AI sees each person&apos;s skills and their own answers, never their
          name, origin, languages or education. Nobody is hidden; you decide.
        </p>
      )}
    </div>
  );
}

/** The AI fit rate and its reason, shown on a candidate card when AI order is on. */
export function AiFitBadge({ fit }: { fit?: RankedCandidate & { rank: number } }) {
  if (!fit) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-accent/50 px-3 py-2 text-xs">
      <Badge className="shrink-0 tabular-nums">
        <SparklesIcon data-icon="inline-start" /> #{fit.rank} · AI fit {fit.fit}%
      </Badge>
      <span className="text-muted-foreground">{fit.reason}</span>
    </div>
  );
}
