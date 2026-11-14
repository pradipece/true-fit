"use client";

import { Agenda } from "@/components/agenda";
import { IdentitySwitch, useIdentity } from "@/components/identity";
import type { FeedbackSide } from "@/lib/types";

/** The signed-in participant's own agenda. Nobody else's pairs are read or shown. */
export function MyAgenda({ side }: { side: FeedbackSide }) {
  const { id, me } = useIdentity(side);
  return (
    <div className="space-y-4">
      <IdentitySwitch side={side} />
      <Agenda key={id} who={{ kind: side, id }} name={me?.name ?? id} />
    </div>
  );
}
