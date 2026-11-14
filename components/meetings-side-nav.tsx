"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon, Building2Icon, UserRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIDES = [
  { href: "/meetings/company", label: "Company view", icon: Building2Icon },
  { href: "/meetings/talent", label: "Candidate view", icon: UserRoundIcon },
];

/** Back link plus a switch between the two meeting views. */
export function MeetingsSideNav() {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/meetings" />}>
        <ArrowLeftIcon data-icon="inline-start" /> Choose a side
      </Button>
      <nav aria-label="Meeting views" className="ml-auto flex gap-1 rounded-lg border p-0.5">
        {SIDES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={pathname === s.href ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground",
              pathname === s.href && "bg-accent text-accent-foreground",
            )}
          >
            <s.icon className="size-4" />
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
