"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  CheckIcon,
  LockKeyholeIcon,
  LogOutIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { ROLE_ICON } from "@/components/role-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Account } from "@/lib/auth/accounts";
import { signIn, signOut } from "@/lib/auth/actions";
import { ROLE_PERMISSIONS } from "@/lib/auth/rbac";
import type { Session } from "@/lib/auth/session";
import { ROLES, type RoleId } from "@/lib/roles";
import { cn } from "@/lib/utils";

const ROLE_COPY: Record<RoleId, { blurb: string; can: string[] }> = {
  talent: {
    blurb: "Browse jobs, build your skill profile and apply.",
    can: ["Browse and apply to jobs", "Build your own skill profile", "Answer invitations and offers"],
  },
  company: {
    blurb: "Post a role, find candidates and interview them.",
    can: ["Post and edit your own roles", "Ask Espoo for introductions", "Interview and make offers"],
  },
  organiser: {
    blurb: "City of Espoo event team: review and introduce.",
    can: ["See every role and candidate", "Introduce and run Espoo interviews", "Event insights and reset"],
  },
};

/** Demo sign-in: pick a role, then one of its synthetic accounts. No passwords. */
export function LoginForm({
  accounts,
  session,
  initialRole,
  next,
  denied,
}: {
  accounts: Account[];
  session: Session | null;
  initialRole?: RoleId;
  next?: string;
  denied?: boolean;
}) {
  const [role, setRole] = useState<RoleId>(initialRole ?? session?.role ?? "talent");
  const [q, setQ] = useState("");
  const list = useMemo(() => accounts.filter((a) => a.role === role), [accounts, role]);
  const [picked, setPicked] = useState<Record<RoleId, string>>(() => ({
    talent: session?.role === "talent" ? session.id : (accounts.find((a) => a.role === "talent")?.id ?? ""),
    company:
      session?.role === "company" ? session.id : (accounts.find((a) => a.role === "company")?.id ?? ""),
    organiser: "ESPOO",
  }));
  const shown = list.filter((a) => `${a.name} ${a.sub}`.toLowerCase().includes(q.trim().toLowerCase()));
  const deniedRole = denied && initialRole ? ROLES.find((r) => r.id === initialRole) : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4">
        <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <LockKeyholeIcon className="size-4" /> Demo sign-in
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">Sign in to True Fit</h1>
        <p className="text-pretty text-muted-foreground">
          Choose who you are. Every account is made up, so there is no password. Each role only sees its own
          pages and can only change its own answers; the server checks every change.
        </p>
        {deniedRole && (
          <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
            <ShieldAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              That page is for the <strong>{deniedRole.label}</strong> role
              {session && (
                <>
                  , and you&apos;re signed in as <strong>{session.name}</strong>
                </>
              )}
              . Sign in with a {deniedRole.label.toLowerCase()} account to open it.
            </span>
          </p>
        )}
        {session && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <ShieldCheckIcon className="size-4 text-evidence" />
            Signed in as <strong>{session.name}</strong>
            <span className="text-muted-foreground">({ROLES.find((r) => r.id === session.role)?.label})</span>
            <form action={signOut} className="ml-auto">
              <Button type="submit" size="xs" variant="ghost">
                <LogOutIcon data-icon="inline-start" /> Sign out
              </Button>
            </form>
          </div>
        )}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">What this role can do</CardTitle>
            <CardDescription>Role-based access, enforced on every page and API call.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {ROLE_COPY[role].can.map((c) => (
                <li key={c} className="flex gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-evidence" /> {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              {ROLE_PERMISSIONS[role].join(" · ")}
            </p>
          </CardContent>
        </Card>
      </div>

      <form action={signIn} className="space-y-4">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="account" value={picked[role]} />
        {next && <input type="hidden" name="next" value={next} />}

        <div role="radiogroup" aria-label="Role" className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => {
            const Icon = ROLE_ICON[r.id];
            const active = role === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  setRole(r.id);
                  setQ("");
                }}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors hover:bg-muted/60",
                  active && "border-primary bg-accent text-accent-foreground ring-1 ring-primary",
                )}
              >
                <Icon className="size-5" />
                <span className="text-sm font-medium">{r.label}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">{ROLE_COPY[r.id].blurb}</span>
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {role === "organiser"
                ? "Event team account"
                : role === "company"
                  ? "Company account"
                  : "Job seeker account"}
            </CardTitle>
            <CardDescription>
              {role === "talent"
                ? "Start as a new job seeker, or sign in as one of the people already registered."
                : role === "company"
                  ? "Start as a new company, or sign in as one already hiring at the event."
                  : "One shared account for the City of Espoo event team."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {list.length > 6 && (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name"
                  className="pl-8"
                  aria-label="Search accounts"
                />
              </div>
            )}
            <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1" role="radiogroup" aria-label="Account">
              {shown.map((a) => {
                const active = picked[role] === a.id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPicked((p) => ({ ...p, [role]: a.id }))}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                        active && "border-primary bg-accent/60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold",
                          active && "bg-primary text-primary-foreground",
                        )}
                      >
                        {initials(a.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{a.sub}</span>
                      </span>
                      {a.id.endsWith("-YOU") && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          New
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {!shown.length && <li className="py-6 text-center text-sm text-muted-foreground">No match.</li>}
            </ul>
            <SubmitButton label={`Sign in as ${list.find((a) => a.id === picked[role])?.name ?? "…"}`} />
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? "Signing in…" : label}
    </Button>
  );
}

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
