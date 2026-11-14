"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, RotateCcwIcon } from "lucide-react";
import { STEPS, stepIndex } from "@/lib/steps";
import { cn } from "@/lib/utils";

/** Previous / next step bar shown at the bottom of every step page. */
export function StepNav() {
  const pathname = usePathname();
  const i = stepIndex(pathname);
  if (i === -1) return null;

  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];

  return (
    <nav aria-label="Demo steps" className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6">
      <div className="flex items-center gap-1.5 pb-4" aria-hidden>
        {STEPS.map((s, j) => (
          <span key={s.href} className={cn("h-1 flex-1 rounded-full bg-muted", j <= i && "bg-primary")} />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <StepLink href={prev.href} step={prev.step} title={prev.title} direction="prev" />
        ) : (
          <span className="hidden sm:block" />
        )}
        {next ? (
          <StepLink href={next.href} step={next.step} title={next.title} direction="next" />
        ) : (
          <StepLink
            href={STEPS[0].href}
            step={STEPS[0].step}
            title="Start the flow again"
            direction="restart"
          />
        )}
      </div>
    </nav>
  );
}

function StepLink({
  href,
  step,
  title,
  direction,
}: {
  href: string;
  step: number;
  title: string;
  direction: "prev" | "next" | "restart";
}) {
  const forward = direction !== "prev";
  const Icon = direction === "prev" ? ArrowLeftIcon : direction === "next" ? ArrowRightIcon : RotateCcwIcon;
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted",
        forward && "sm:col-start-2 sm:flex-row-reverse sm:text-right",
        direction === "next" && "border-primary/40",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-foreground" />
      <span className="min-w-0">
        <span className="block text-xs text-muted-foreground">
          {direction === "prev" ? "Previous" : direction === "next" ? "Next" : "Done"} · Step {step}
        </span>
        <span className="block truncate font-medium">{title}</span>
      </span>
    </Link>
  );
}
