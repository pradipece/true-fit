import { FileTextIcon, MicIcon, QuoteIcon } from "lucide-react";
import { SkillChip } from "@/components/skill-chip";
import { skillLabel } from "@/lib/esco";
import { SCORING } from "@/lib/match";
import type { MatchExplanation, ScoreLine } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Plain-language summary of why a pair was suggested. Written from rules, not a black box. */
export function matchSentence(m: MatchExplanation) {
  const ev = m.shared.filter((s) => s.level === "evidenced").map((s) => skillLabel(s.skill).toLowerCase());
  const parts: string[] = [];
  if (ev.length) parts.push(`has shown ${listJoin(ev)} in their answers`);
  const claimed = m.shared.filter((s) => s.level === "claimed").map((s) => skillLabel(s.skill).toLowerCase());
  if (claimed.length) parts.push(`says they have ${listJoin(claimed)}`);
  if (m.transferable.length) {
    const t = m.transferable[0];
    parts.push(`could transfer ${skillLabel(t.from).toLowerCase()} → ${skillLabel(t.to).toLowerCase()}`);
  }
  if (!parts.length) return "Few skills in common with this need yet.";
  const s = parts.join("; ");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

function listJoin(xs: string[]) {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

export function ScoreMeter({
  score,
  role,
  className,
}: {
  score: number;
  /** The job title the percentage is for, e.g. "Backend developer". */
  role?: string;
  className?: string;
}) {
  const pct = Math.round(score * 100);
  const segments = 10;
  const filled = Math.round(score * segments);
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-label={role ? `Skill match ${pct}% for ${role}` : `Skill match ${pct}%`}
    >
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
      <span className="text-xs text-muted-foreground tabular-nums">
        {role ? (
          <>
            <span className="font-medium text-foreground">{pct}%</span> match for{" "}
            <span className="font-medium text-foreground">{role}</span>
          </>
        ) : (
          `${pct}% skill match`
        )}
      </span>
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
      <ScoreBreakdown m={m} />
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

const pts = (n: number) => (Math.round(n * 100) / 100).toString();

function lineResult(l: ScoreLine) {
  const lvl = l.level === "evidenced" ? "shown" : "stated";
  if (l.kind === "direct") return `Has it (${lvl})`;
  if (l.kind === "gap") return "Not shown";
  const occ = l.occupations?.length ? `; both used by a ${l.occupations[0]}` : "";
  return `Via ${skillLabel(l.from!)} (${lvl}, relation ${l.relation}${occ})`;
}

/** Every point of the score, line by line, with the rules underneath. */
export function ScoreBreakdown({ m }: { m: MatchExplanation }) {
  return (
    <details className="group text-xs">
      <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
        How this {Math.round(m.score * 100)}% is worked out
      </summary>
      <div className="mt-2 overflow-x-auto rounded-lg border">
        <table className="w-full text-left">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">Required skill</th>
              <th className="px-2 py-1.5 font-medium">Result</th>
              <th className="px-2 py-1.5 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {m.breakdown.map((l) => (
              <tr key={l.skill} className="border-t">
                <td className="px-2 py-1.5">
                  {skillLabel(l.skill)}
                  {l.must && (
                    <span className="ml-1 text-[10px] font-semibold uppercase opacity-60">must</span>
                  )}
                </td>
                <td
                  className={cn(
                    "px-2 py-1.5",
                    l.kind === "direct" && "text-evidence",
                    l.kind === "transfer" && "text-transfer",
                    l.kind === "gap" && "text-muted-foreground",
                  )}
                >
                  {lineResult(l)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {pts(l.points)} / {l.max}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t bg-muted/30 font-medium">
            <tr>
              <td className="px-2 py-1.5" colSpan={2}>
                Total ({Math.round(m.score * 100)}%, suggestions start at {SCORING.suggestThreshold * 100}%)
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {pts(m.points)} / {m.maxPoints}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-1.5 leading-snug text-muted-foreground">
        Must-have {SCORING.mustWeight} points, nice-to-have {SCORING.niceWeight}. Skills shown in answers earn
        full points, stated ones {SCORING.claimed * 100}%. A related skill earns relation × level ×{" "}
        {SCORING.transferFactor}. Only skills are scored: never name, origin, language, education, career path
        or age.
      </p>
    </details>
  );
}
