import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { accounts } from "@/lib/auth/accounts";
import { isRole } from "@/lib/auth/rbac";
import { getSession } from "@/lib/auth/server";
import { getSeed } from "@/lib/seed-db";

export const metadata: Metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function Login({ searchParams }: { searchParams: SearchParams }) {
  const [sp, session] = await Promise.all([searchParams, getSession(), getSeed()]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const role = one(sp.role);
  return (
    <LoginForm
      // Re-mount per role, so a header tab (/login?role=…) opens that role's section even
      // when the login page is already showing.
      key={`${role ?? ""}:${one(sp.denied) ?? ""}`}
      accounts={accounts()}
      session={session}
      initialRole={isRole(role) ? role : undefined}
      next={one(sp.next)}
      denied={one(sp.denied) === "1"}
    />
  );
}

export default function LoginPage(props: { searchParams: SearchParams }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense
        fallback={<p className="py-24 text-center text-sm text-muted-foreground">Loading accounts…</p>}
      >
        <Login searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
