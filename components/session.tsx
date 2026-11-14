"use client";

import { createContext, useContext, useTransition } from "react";
import { switchAccount } from "@/lib/auth/actions";
import { can, type Permission } from "@/lib/auth/rbac";
import type { Session } from "@/lib/auth/session";

/** The signed-in demo account, read on the server (lib/auth/server.ts) and passed down. */
const SessionContext = createContext<Session | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return <SessionContext value={session}>{children}</SessionContext>;
}

export function useSession() {
  const session = useContext(SessionContext);
  return { session, can: (perm: Permission) => can(session?.role, perm) };
}

/** Demo shortcut: sign in as another account and open a page (a server action sets the cookie). */
export function useSwitchAccount() {
  const [pending, start] = useTransition();
  return {
    pending,
    switchTo: (role: Session["role"], id: string, next?: string) =>
      start(() => switchAccount(role, id, next)),
  };
}
