import { companyOf } from "./schedule";
import type { Decision, FeedbackSide, Need } from "./types";

/**
 * Who the person using a side's pages is. In production they would sign in; in the demo
 * each side has one current identity, and every page on that side (meetings, agenda)
 * shows only that identity's own pairs, never anyone else's.
 */
export const OWN_ID: Record<FeedbackSide, string> = { company: "C-YOU", talent: "T-YOU" };

export const approvedKeys = (decisions: Record<string, Decision>) =>
  Object.entries(decisions)
    .filter(([, d]) => d.status === "approved")
    .map(([k]) => k);

/** The participant on `side` that a pair belongs to. */
export function pairOwner(side: FeedbackSide, key: string, needs: Pick<Need, "id" | "companyId">[]) {
  const [needId, talentId] = key.split("::");
  if (side === "talent") return talentId;
  const need = needs.find((n) => n.id === needId);
  return need ? companyOf(need) : undefined;
}

/**
 * The current identity: the explicit demo choice if it still exists, else the person's
 * own card when they made one (or it has approved matches), else the first participant
 * who has matches, so the demo opens on something to look at.
 */
export function currentIdentity(
  side: FeedbackSide,
  chosen: string | undefined,
  validIds: string[],
  approved: string[],
  needs: Pick<Need, "id" | "companyId">[],
  ownExists = false,
) {
  if (chosen && validIds.includes(chosen)) return chosen;
  const owners = approved.map((k) => pairOwner(side, k, needs)).filter((x): x is string => !!x);
  if (ownExists || owners.includes(OWN_ID[side])) return OWN_ID[side];
  return validIds.find((id) => owners.includes(id)) ?? OWN_ID[side];
}
