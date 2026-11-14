"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDaysIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-provider";
import { EVENT } from "@/lib/data";
import { ROLE_ICON } from "@/components/role-icons";
import { activePage, ROLES, roleOf } from "@/lib/roles";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { reset } = useDemo();
  const role = roleOf(pathname);
  const page = role && activePage(role, pathname);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
            TF
          </span>
          <span className="hidden sm:inline">True Fit</span>
        </Link>

        <nav
          aria-label="Views"
          className="-mx-1 flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto px-1"
        >
          {ROLES.map((r) => {
            const Icon = ROLE_ICON[r.id];
            const active = role?.id === r.id;
            return (
              <Link
                key={r.id}
                href={r.pages[0].href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {r.label}
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

      {role && (
        <div className="border-t">
          <nav
            aria-label={`${role.label} pages`}
            className="mx-auto flex h-10 max-w-7xl [scrollbar-width:none] items-center gap-1 overflow-x-auto px-4 sm:px-6"
          >
            <span className="mr-2 hidden shrink-0 text-xs text-muted-foreground sm:inline">{role.title}</span>
            {role.pages.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                aria-current={page?.href === p.href ? "page" : undefined}
                className={cn(
                  "relative flex h-full shrink-0 items-center px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  page?.href === p.href &&
                    "font-medium text-foreground after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
                )}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
