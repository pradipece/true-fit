import { FileTextIcon, MicIcon, QuoteIcon } from "lucide-react";
import { SkillChip } from "@/components/skill-chip";
import { skillLabel } from "@/lib/esco";
import type { MatchExplanation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Plain-language summary of why a pair was suggested. Written from rules, not a black box. */
export function matchSentence(m: MatchExplanation) {
  const ev = m.shared.filter((s) => s.level === "evidenced").map((s) => skillLabel(s.skill).toLowerCase());
  const parts: string[] = [];
  if (ev.length) parts.push(`shows evidence of ${listJoin(ev)}`);
  const claimed = m.shared.filter((s) => s.level === "claimed").map((s) => skillLabel(s.skill).toLowerCase());
  if (claimed.length) parts.push(`reports ${listJoin(claimed)}`);
  if (m.transferable.length) {
    const t = m.transferable[0];
    parts.push(`could transfer ${skillLabel(t.from).toLowerCase()} → ${skillLabel(t.to).toLowerCase()}`);
  }
  if (!parts.length) return "Little overlap with this need yet.";
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

function listJoin(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

export function ScoreMeter({ score, className }: { score: number; className?: string }) {
  const pct = Math.round(score * 100);
  const segments = 10;
  const filled = Math.round(score * segments);
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label={`Skill overlap ${pct}%`}>
      <div className="flex gap-0.5">
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-1.5 rounded-[2px] bg-muted",
              i < filled && (score >= 0.6 ? "bg-evidence" : "bg-primary"),
            )}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{pct}% overlap</span>
    </div>
  );
}

export function MatchExplanationView({
  m,
  showQuotes = true,
}: {
  m: MatchExplanation;
  showQuotes?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed">{matchSentence(m)}</p>
      <div className="flex flex-wrap gap-1.5">
        {m.shared.map((s) => (
          <SkillChip key={s.skill} id={s.skill} kind={s.level} must={s.must} />
        ))}
        {m.transferable.map((t) => (
          <SkillChip key={t.to} id={t.to} from={t.from} kind="transfer" must={t.must} />
        ))}
        {m.gaps.map((g) => (
          <SkillChip key={g.skill} id={g.skill} kind="gap" must={g.must} />
        ))}
      </div>
      {showQuotes && m.quotes.length > 0 && (
        <div className="space-y-2">
          {m.quotes.slice(0, 2).map((q) => (
            <figure key={q.excerpt} className="rounded-lg border bg-muted/40 p-3">
              <figcaption className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {q.kind === "voice" ? (
                  <MicIcon className="size-3.5" />
                ) : q.kind === "sample" ? (
                  <FileTextIcon className="size-3.5" />
                ) : (
                  <QuoteIcon className="size-3.5" />
                )}
                {q.prompt}
              </figcaption>
              <blockquote className="text-sm leading-relaxed">“{q.excerpt}”</blockquote>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
