"use client";

import { useMemo } from "react";
import { UserRoundCogIcon } from "lucide-react";
import { approvedKeys, currentIdentity, OWN_ID } from "@/lib/identity";
import { companyOf } from "@/lib/schedule";
import { participants } from "@/lib/participants";
import { useDemo } from "@/lib/store";
import type { FeedbackSide } from "@/lib/types";

const PEOPLE = participants();

/** Who is using this side's pages, and the participants they could switch to (demo). */
export function useIdentity(side: FeedbackSide) {
  const { actingAs, decisions, needs, talent, setActingAs } = useDemo();
  const options = useMemo(() => PEOPLE.filter((p) => p.kind === side), [side]);
  const id = currentIdentity(
    side,
    actingAs?.[side],
    options.map((p) => p.id),
    approvedKeys(decisions),
    needs,
    side === "company"
      ? needs.some((n) => companyOf(n) === OWN_ID.company)
      : talent.some((t) => t.id === OWN_ID.talent),
  );
  const me = options.find((p) => p.id === id) ?? options[0];
  return { id, me, options, set: (next: string) => setActingAs(side, next) };
}

/**
 * Demo stand-in for signing in. In production each company or candidate signs in and
 * this control doesn't exist: they only ever see their own pairs and agenda.
 */
export function IdentitySwitch({ side }: { side: FeedbackSide }) {
  const { id, options, set } = useIdentity(side);
  return (
    <label className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm print:hidden">
      <UserRoundCogIcon className="size-4 text-muted-foreground" />
      <span className="text-muted-foreground">Signed in as (demo):</span>
      <select
        value={id}
        onChange={(e) => set(e.target.value)}
        className="max-w-full rounded-md border bg-background px-2 py-1 text-sm"
      >
        {options.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        You only see this {side === "company" ? "company" : "candidate"}&apos;s own meetings.
      </span>
    </label>
  );
}
