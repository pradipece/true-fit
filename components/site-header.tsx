"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudAlertIcon,
  CloudCheckIcon,
  CloudIcon,
  LogInIcon,
  LogOutIcon,
  RotateCcwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session";
import { ThemeToggle } from "@/components/theme-provider";
import { signOut } from "@/lib/auth/actions";
import { ROLE_ICON } from "@/components/role-icons";
import { activePage, ROLES, roleOf } from "@/lib/roles";
import { useDemo } from "@/lib/store";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const { reset, sync } = useDemo();
  const { session, can } = useSession();
  const role = roleOf(pathname);
  // RBAC: a signed-in account only gets its own role's tab; signed out, the tabs lead to sign-in.
  const tabs = session ? ROLES.filter((r) => r.id === session.role) : ROLES;
  const page = role && activePage(role, pathname);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-[13px] font-bold text-primary-foreground">
            PT
          </span>
          <span className="hidden sm:inline">True Fit</span>
        </Link>

        <nav
          aria-label="Views"
          className="-mx-1 flex min-w-0 flex-1 [scrollbar-width:none] items-center gap-0.5 overflow-x-auto px-1"
        >
          {tabs.map((r) => {
            const Icon = ROLE_ICON[r.id];
            const active = role?.id === r.id;
            return (
              <Link
                key={r.id}
                href={session ? r.pages[0].href : `/login?role=${r.id}`}
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

        {session && <SyncBadge status={sync} />}
        {can("organiser:reset") && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset data"
            title="Reset data (Espoo only)"
            onClick={() => {
              reset();
              toast("Data reset.", {
                description: "The shared database copy is reset too.",
              });
            }}
          >
            <RotateCcwIcon />
          </Button>
        )}
        <ThemeToggle />
        {session ? (
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              title="Switch account"
              className="hidden max-w-40 items-center gap-2 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs hover:bg-muted md:flex"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {session.name
                  .replace(/\(.*?\)/g, "")
                  .trim()
                  .slice(0, 1)
                  .toUpperCase()}
              </span>
              <span className="truncate">{session.name}</span>
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
                <LogOutIcon />
              </Button>
            </form>
          </div>
        ) : (
          <Button size="sm" nativeButton={false} render={<Link href="/login" />}>
            <LogInIcon data-icon="inline-start" /> Sign in
          </Button>
        )}
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

/** Whether the demo state is saved to the shared database (app/api/demo-state). */
function SyncBadge({ status }: { status: ReturnType<typeof useDemo>["sync"] }) {
  const {
    icon: Icon,
    label,
    title,
  } = {
    loading: { icon: CloudIcon, label: "Loading…", title: "Loading the shared demo data from the database" },
    saving: { icon: CloudIcon, label: "Saving…", title: "Saving your changes to the database" },
    saved: {
      icon: CloudCheckIcon,
      label: "Saved",
      title: "Everything is saved to the database and shared with other browsers",
    },
    error: {
      icon: CloudAlertIcon,
      label: "Not saved",
      title: "The database can't be reached. Changes stay in this browser until it can.",
    },
  }[status];
  return (
    <span
      title={title}
      role="status"
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        status === "error" && "text-destructive",
        status === "saved" && "text-evidence",
      )}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
