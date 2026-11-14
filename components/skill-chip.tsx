import { ArrowRightIcon, BadgeCheckIcon, CircleDashedIcon, CircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { skillLabel } from "@/lib/esco";
import { cn } from "@/lib/utils";

type Kind = "evidenced" | "claimed" | "transfer" | "gap" | "neutral";

const STYLES: Record<Kind, string> = {
  evidenced: "border-evidence/30 bg-evidence-soft text-evidence",
  claimed: "border-border bg-secondary text-secondary-foreground",
  transfer: "border-transfer/30 bg-transfer-soft text-transfer",
  gap: "border-dashed border-border bg-transparent text-gap",
  neutral: "border-border bg-card text-foreground",
};

export function SkillChip({
  id,
  kind = "neutral",
  from,
  must,
  className,
}: {
  id: string;
  kind?: Kind;
  from?: string;
  must?: boolean;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 px-2 font-normal", STYLES[kind], className)}>
      {kind === "evidenced" && <BadgeCheckIcon data-icon="inline-start" />}
      {kind === "claimed" && <CircleIcon data-icon="inline-start" />}
      {kind === "gap" && <CircleDashedIcon data-icon="inline-start" />}
      {kind === "transfer" && from && (
        <>
          <span className="opacity-80">{skillLabel(from)}</span>
          <ArrowRightIcon />
        </>
      )}
      {skillLabel(id)}
      {must && (
        <span className="ml-0.5 text-[10px] font-semibold tracking-wide uppercase opacity-70">must</span>
      )}
    </Badge>
  );
}

export function SkillLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)}
    >
      <span className="flex items-center gap-1.5">
        <BadgeCheckIcon className="size-3.5 text-evidence" /> Evidenced by a scenario, voice note or sample
      </span>
      <span className="flex items-center gap-1.5">
        <CircleIcon className="size-3.5" /> Self-reported
      </span>
      <span className="flex items-center gap-1.5">
        <ArrowRightIcon className="size-3.5 text-transfer" /> Transferable from a related skill
      </span>
      <span className="flex items-center gap-1.5">
        <CircleDashedIcon className="size-3.5" /> Not shown yet
      </span>
    </div>
  );
}
