import { stableJson, type PairRow, type Patch, type Snapshot } from "../demo-state";
import type { RoleId } from "../roles";
import type { Need } from "../types";

/**
 * Who may change which part of a pair (one row per need × candidate, lib/demo-state.ts).
 * The server runs this on every PATCH to /api/demo-state against what the database holds,
 * so a browser can't write the other side's answers even with hand-made requests.
 *
 *   setting or changing a value → the role in FIELD_WRITERS, and (company / talent) only on
 *                                 its own pairs
 *   clearing a value            → the organiser, or either side on its own pair (a decline,
 *                                 a withdrawal or an undo clears the later steps)
 *   audit entries               → organiser only
 *   cards                       → a company only its own need cards, a candidate only its own card
 */

type Field = { name: string; read: (r: PairRow | undefined) => unknown; writers: RoleId[] };

const FIELDS: Field[] = [
  { name: "decision", read: (r) => r?.decision, writers: ["organiser"] },
  { name: "optIn.company", read: (r) => r?.optIn?.company, writers: ["company"] },
  { name: "optIn.talent", read: (r) => r?.optIn?.talent, writers: ["talent"] },
  { name: "screening.answer", read: (r) => r?.screening?.answer, writers: ["talent"] },
  // The Espoo interview time: the candidate books it, the Espoo desk may move it.
  { name: "screening.slot", read: (r) => r?.screening?.slot, writers: ["talent", "organiser"] },
  {
    name: "screening.result",
    read: (r) =>
      r?.screening && {
        result: r.screening.result,
        reason: r.screening.reason,
        note: r.screening.note,
        at: r.screening.at,
      },
    writers: ["organiser"],
  },
  // Either side books the company interview.
  { name: "slot", read: (r) => r?.slot, writers: ["company", "talent"] },
  {
    name: "offer",
    read: (r) => r?.offer && { status: r.offer.status, note: r.offer.note, at: r.offer.at },
    writers: ["company"],
  },
  {
    name: "offer.answer",
    read: (r) => r?.offer && { answer: r.offer.answer, answeredAt: r.offer.answeredAt },
    writers: ["talent"],
  },
  { name: "feedback.company", read: (r) => r?.feedback?.company, writers: ["company"] },
  { name: "feedback.talent", read: (r) => r?.feedback?.talent, writers: ["talent"] },
];

const empty = (v: unknown) =>
  v === undefined ||
  v === null ||
  (typeof v === "object" && Object.values(v as object).every((x) => x === undefined));

export type Who = { role: RoleId; id: string };

/** The company id a need belongs to (seed or demo card). */
const companyOfNeed = (needs: Pick<Need, "id" | "companyId">[], needId: string) => {
  const n = needs.find((x) => x.id === needId);
  return n ? (n.companyId ?? "C-YOU") : undefined;
};

/** Is `who` one of the two sides of this pair? The organiser is a party to every pair. */
export function isParty(who: Who, key: string, needs: Pick<Need, "id" | "companyId">[]) {
  if (who.role === "organiser") return true;
  const [needId, talentId] = key.split("::");
  return who.role === "talent" ? talentId === who.id : companyOfNeed(needs, needId) === who.id;
}

/** null if `who` may apply the patch to `current`, else the first reason it may not. */
export function authorizePatch(
  patch: Patch,
  current: Snapshot,
  who: Who,
  seedNeeds: Pick<Need, "id" | "companyId">[],
): string | null {
  // Needs a pair key can refer to: seed, saved demo cards, and cards in this same patch
  // (checked below, so a company can't claim someone else's need through it).
  const needs = [...patch.needs, ...current.needs, ...seedNeeds];

  for (const n of patch.needs) {
    if (who.role !== "company") return "Only a company can save a need card";
    if ((n.companyId ?? "C-YOU") !== who.id) return "A company can only save its own need cards";
    const before = companyOfNeed([...current.needs, ...seedNeeds], n.id);
    if (before && before !== who.id) return "That need card belongs to another company";
  }
  for (const t of patch.talent) {
    if (who.role !== "talent" || t.id !== who.id) return "A job seeker can only save their own card";
  }
  if (patch.audit.length && who.role !== "organiser") return "Only the organiser writes the decision log";

  for (const [key, next] of Object.entries(patch.pairs)) {
    const party = isParty(who, key, needs);
    const prev = current.pairs[key];
    for (const f of FIELDS) {
      const a = f.read(prev);
      const b = f.read(next ?? undefined);
      if (stableJson(a ?? null) === stableJson(b ?? null)) continue;
      if (empty(b)) {
        if (!party) return `Not your pair: ${key}`;
        continue;
      }
      if (!f.writers.includes(who.role)) return `Your role can't change ${f.name}`;
      if (!party) return `Not your pair: ${key}`;
    }
  }
  return null;
}
