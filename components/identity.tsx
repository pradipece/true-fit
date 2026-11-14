"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { BellDotIcon, UserRoundCogIcon } from "lucide-react";
import { currentIdentity, OWN_ID, pairOwner } from "@/lib/identity";
import { activeKeys, myTurn, stageOf, visibleTo } from "@/lib/pipeline";
import { companyOf } from "@/lib/schedule";
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

/** Who is using this side's pages, and the participants they could switch to (demo). */
export function useIdentity(side: FeedbackSide) {
  const { actingAs, needs, talent, setActingAs } = useDemo();
  const { keys, counts } = useSideCounts(side);
  // participants() reads the seed registry, which DemoProvider fills before this renders.
  const options = useMemo(() => participants().filter((p) => p.kind === side), [side]);
  const id = currentIdentity(
    side,
    actingAs?.[side],
    options.map((p) => p.id),
    keys,
    needs,
    side === "company"
      ? needs.some((n) => companyOf(n) === OWN_ID.company)
      : talent.some((t) => t.id === OWN_ID.talent),
  );
  const me = options.find((p) => p.id === id) ?? options[0];
  return { id, me, options, counts, set: (next: string) => setActingAs(side, next) };
}

/**
 * Demo only: open a side's pipeline page as the participant a pair belongs to, so an
 * invitation made in the organiser view can be followed straight into the candidate's or
 * company's own view.
 */
export function useViewAs() {
  const { setActingAs, needs } = useDemo();
  const router = useRouter();
  return (side: FeedbackSide, key: string) => {
    const owner = pairOwner(side, key, needs);
    if (owner) setActingAs(side, owner);
    router.push(`/meetings/${side}?pair=${encodeURIComponent(key)}`);
  };
}

/**
 * Demo stand-in for signing in. In production each company or candidate signs in and
 * this control doesn't exist: they only ever see their own pairs and agenda.
 */
export function IdentitySwitch({ side }: { side: FeedbackSide }) {
  const { id, options, counts, set } = useIdentity(side);
  const { talent } = useDemo();
  const label = (pid: string, seedName: string) => {
    // The candidate's own card made in the demo shows its name once it has one.
    const own = pid === OWN_ID.talent ? talent.find((t) => t.id === pid) : undefined;
    const name = own?.contact?.fullName ? `${own.contact.fullName} (${pid})` : seedName;
    const c = counts.get(pid);
    if (!c) return name;
    return c.todo ? `${name} · ${c.todo} to answer` : `${name} · ${c.total} in progress`;
  };
  // Make updates for other demo participants easy to find: the usual reason "nothing shows up".
  const elsewhere = options
    .filter((p) => p.id !== id && counts.get(p.id)?.todo)
    .sort((a, b) => counts.get(b.id)!.todo - counts.get(a.id)!.todo)
    .slice(0, 3);
  return (
    <div className="space-y-2 print:hidden">
      <label className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
        <UserRoundCogIcon className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">Signed in as (demo):</span>
        <select
          value={id}
          onChange={(e) => set(e.target.value)}
          className="max-w-full rounded-md border bg-background px-2 py-1 text-sm"
        >
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {label(p.id, p.name)}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          You only see this {side === "company" ? "company" : "candidate"}&apos;s own pipeline.
        </span>
      </label>
      {elsewhere.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-muted-foreground">
          <BellDotIcon className="size-3.5 text-primary" />
          Demo: other {side === "company" ? "companies" : "candidates"} have something to answer:
          {elsewhere.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => set(p.id)}
              className="rounded-full border px-2 py-0.5 font-medium text-foreground hover:bg-muted"
            >
              {p.name} ({counts.get(p.id)!.todo})
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
