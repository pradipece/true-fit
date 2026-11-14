import { STEPS, stepState, type PairStage } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/** Small dots for the six steps, for list rows. */
export function MiniSteps({ p }: { p: PairStage }) {
  return (
    <span className="flex gap-0.5" aria-label={`Step ${p.step + 1} of ${STEPS.length}`}>
      {STEPS.map((s, i) => {
        const st = stepState(p, i);
        return (
          <span
            key={s.id}
            className={cn(
              "h-1.5 w-3 rounded-full",
              st === "done" && "bg-evidence",
              st === "current" && "bg-primary",
              st === "stopped" && "bg-destructive",
              st === "todo" && "bg-muted-foreground/25",
            )}
          />
        );
      })}
    </span>
  );
}

/** The six pipeline steps, with where this pair stands. */
export function Stepper({ p, className }: { p: PairStage; className?: string }) {
  return (
    <ol className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6", className)}>
      {STEPS.map((s, i) => {
        const st = stepState(p, i);
        return (
          <li
            key={s.id}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-xs",
              st === "done" && "border-evidence/30 bg-evidence-soft text-evidence",
              st === "current" && "border-primary bg-accent text-accent-foreground ring-2 ring-primary/20",
              st === "stopped" && "border-destructive/40 bg-destructive/5 text-destructive",
              st === "todo" && "border-dashed text-muted-foreground",
            )}
          >
            <span className="block font-semibold tabular-nums">
              {i + 1}
              {st === "done" && " ✓"}
              {st === "stopped" && " ✕"}
            </span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
