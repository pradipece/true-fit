"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDaysIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-provider";
import { EVENT } from "@/lib/data";
import { FIRST_STEP, STEPS, stepIndex } from "@/lib/steps";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { reset } = useDemo();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href={FIRST_STEP.href} className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
            TF
          </span>
          <span className="hidden sm:inline">True Fit</span>
        </Link>

        <nav className="-mx-1 flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto px-1">
          {STEPS.map((item, i) => {
            const active = stepIndex(pathname) === i;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-4 place-items-center rounded-full border text-[10px] tabular-nums",
                    active && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {item.step}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground lg:flex">
          <CalendarDaysIcon className="size-3.5" />
          {EVENT.date} · {EVENT.place}
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Reset demo data"
          onClick={() => {
            reset();
            toast("Demo data reset to the synthetic seed.");
          }}
        >
          <RotateCcwIcon />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
