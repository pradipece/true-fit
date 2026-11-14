"use client";

import { Building2Icon, TrophyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScoreMeter } from "@/components/match-explanation";
import type { CompanyFit } from "@/lib/explore";
import type { MatchExplanation, Need } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Companies ranked for one candidate (`companiesFor`): each company by its best-matching
 * role, with every role it has underneath. Used on Explore roles (the candidate's own
 * ranking) and in the organiser's "By candidate" view. Skills-only, like every match.
 */
export function CompanyRanking({
  companies,
  renderRole,
  className,
}: {
  companies: CompanyFit<Need>[];
  /** Optional status or action shown on each role row. */
  renderRole?: (need: Need, m: MatchExplanation) => React.ReactNode;
  className?: string;
}) {
  if (!companies.length)
    return <p className="text-sm text-muted-foreground">No companies have roles at this event yet.</p>;
  return (
    <ol className={cn("space-y-3", className)}>
      {companies.map((c, i) => {
        const first = c.best.need;
        return (
          <li key={c.companyId} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  i === 0 && c.strong > 0 ? "bg-evidence text-white" : "bg-muted text-muted-foreground",
                )}
                aria-label={`Rank ${i + 1}`}
              >
                {i === 0 && c.strong > 0 ? <TrophyIcon className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex items-center gap-1.5 font-medium">
                  <Building2Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{first.company}</span>
                  {c.strong > 0 && (
                    <Badge
                      variant="outline"
                      className="border-evidence/30 bg-evidence-soft font-normal text-evidence"
                    >
                      {c.strong} strong {c.strong === 1 ? "fit" : "fits"}
                    </Badge>
                  )}
                </p>
                {first.companyBlurb && (
                  <p className="truncate text-xs text-muted-foreground">{first.companyBlurb}</p>
                )}
              </div>
              <ScoreMeter score={c.best.m.score} />
            </div>
            <ul className="mt-3 divide-y border-t">
              {c.roles.map(({ need, m }) => (
                <li key={need.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {need.title}
                    {!m.suggested && (
                      <span className="ml-1.5 text-xs text-muted-foreground">below the suggestion line</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "w-10 text-right text-xs font-medium tabular-nums",
                      m.suggested ? "text-evidence" : "text-muted-foreground",
                    )}
                  >
                    {Math.round(m.score * 100)}%
                  </span>
                  {renderRole && <span className="flex items-center gap-1.5">{renderRole(need, m)}</span>}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
