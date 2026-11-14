"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BellDotIcon, UserRoundCheckIcon } from "lucide-react";
import { useSession, useSwitchAccount } from "@/components/session";
import { OWN_ID, pairOwner } from "@/lib/identity";
import { activeKeys, myTurn, stageOf, visibleTo } from "@/lib/pipeline";
import { participants } from "@/lib/participants";
import { useDemo } from "@/lib/store";
import type { FeedbackSide } from "@/lib/types";

/** Per participant on a side: how many pairs they can see, and how many wait for their move. */
function useSideCounts(side: FeedbackSide) {
  const { decisions, optIns, slots, screening, offers, needs } = useDemo();
  return useMemo(() => {
    const state = { decisions, optIns, slots, screening, offers };
    const keys = activeKeys(state).filter((k) => visibleTo(side, k, state));
    const counts = new Map<string, { total: number; todo: number }>();
    for (const k of keys) {
      const owner = pairOwner(side, k, needs);
      if (!owner) continue;
      const c = counts.get(owner) ?? { total: 0, todo: 0 };
      c.total++;
      if (myTurn(side, stageOf(k, state))) c.todo++;
      counts.set(owner, c);
    }
    return { keys, counts };
  }, [side, decisions, optIns, slots, screening, offers, needs]);
}

/**
 * Who is using this side's pages: the signed-in account (lib/auth). proxy.ts only lets the
 * matching role open a side's pages, so the fallback to the side's new account only matters
 * before the session has loaded.
 */
export function useIdentity(side: FeedbackSide) {
  const { session } = useSession();
  const { counts } = useSideCounts(side);
  // participants() reads the seed registry, which DemoProvider fills before this renders.
  const options = useMemo(() => participants().filter((p) => p.kind === side), [side]);
  const id = session?.role === side ? session.id : OWN_ID[side];
  // Job seekers who signed up themselves aren't in the seed list: describe them from the session.
  const me =
    options.find((p) => p.id === id) ??
    (session?.role === side ? { kind: side, id, name: session.name, sub: "" } : options[0]);
  return { id, me, options, counts };
}

/**
 * Demo only: sign in as the participant a pair belongs to and open their pipeline page, so
 * an invitation made in the organiser view can be followed into the candidate's or the
 * company's own view. It is a real account switch: the organiser view closes.
 */
export function useViewAs() {
  const { needs } = useDemo();
  const { switchTo } = useSwitchAccount();
  return (side: FeedbackSide, key: string) => {
    const owner = pairOwner(side, key, needs);
    if (owner) switchTo(side, owner, `/meetings/${side}?pair=${encodeURIComponent(key)}`);
  };
}

/**
 * Who you are signed in as on this side, with a link to switch account, and (demo) other
 * accounts that have something to answer, since that's the usual reason "nothing shows up".
 */
export function IdentitySwitch({ side }: { side: FeedbackSide }) {
  const { id, me, options, counts } = useIdentity(side);
  const { switchTo, pending } = useSwitchAccount();
  const { session } = useSession();
  const { talent } = useDemo();
  const own = talent.find((t) => t.id === id && t.createdByUser);
  const name = own?.contact?.fullName || session?.name || me?.name || id;
  const mine = counts.get(id);
  const elsewhere = options
    .filter((p) => p.id !== id && counts.get(p.id)?.todo)
    .sort((a, b) => counts.get(b.id)!.todo - counts.get(a.id)!.todo)
    .slice(0, 3);
  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
        <UserRoundCheckIcon className="size-4 text-primary" />
        <span className="text-muted-foreground">Signed in as</span>
        <span className="font-medium">{name}</span>
        {mine && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
            {mine.todo ? `${mine.todo} to answer` : `${mine.total} in progress`}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          · You only see this {side === "company" ? "company" : "candidate"}&apos;s own pipeline.
        </span>
        <Link
          href={`/login?role=${side}`}
          className="ml-auto text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Switch account
        </Link>
      </div>
      {elsewhere.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted-foreground">
          <BellDotIcon className="size-3.5 text-primary" />
          Demo: other {side === "company" ? "companies" : "candidates"} have something to answer. Sign in as:
          {elsewhere.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => switchTo(side, p.id, window.location.pathname)}
              className="rounded-full border px-2 py-0.5 font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {p.name} ({counts.get(p.id)!.todo})
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
