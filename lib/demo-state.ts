import type { Offer, Screening } from "./pipeline";
import type { OptIn } from "./schedule";
import type { AuditEntry, Decision, Feedback, Need, Talent } from "./types";

/**
 * The demo state as the database keeps it (db/schema.sql: pipeline_pairs, pipeline_audit,
 * demo_cards). One row per pair holds every step of the pipeline, so two people working on
 * different pairs at the same time never overwrite each other. Pure and shared by the browser
 * (lib/store.tsx) and the server (lib/demo-state-db.ts, app/api/demo-state).
 */

export type PairRow = {
  decision?: Decision;
  optIn?: OptIn;
  screening?: Screening;
  slot?: string;
  offer?: Offer;
  feedback?: Feedback;
};

export type Snapshot = {
  pairs: Record<string, PairRow>;
  audit: AuditEntry[];
  /** Cards created during the demo (createdByUser); seed cards come from the seed tables. */
  needs: Need[];
  talent: Talent[];
};

/** A change set: pairs to upsert (null = delete), new audit entries, cards to upsert. */
export type Patch = {
  pairs: Record<string, PairRow | null>;
  audit: AuditEntry[];
  needs: Need[];
  talent: Talent[];
};

export type PipelineMaps = {
  decisions: Record<string, Decision>;
  optIns: Record<string, OptIn>;
  slots: Record<string, string>;
  screening: Record<string, Screening>;
  offers: Record<string, Offer>;
  feedback: Record<string, Feedback>;
  audit: AuditEntry[];
  needs: Need[];
  talent: Talent[];
};

export const EMPTY_SNAPSHOT: Snapshot = { pairs: {}, audit: [], needs: [], talent: [] };

const isEmptyObj = (o: object | undefined) => !o || Object.values(o).every((v) => v === undefined);

/** The store's maps → one row per pair, dropping empty rows. */
export function toSnapshot(s: PipelineMaps): Snapshot {
  const keys = new Set([
    ...Object.keys(s.decisions),
    ...Object.keys(s.optIns),
    ...Object.keys(s.slots),
    ...Object.keys(s.screening),
    ...Object.keys(s.offers),
    ...Object.keys(s.feedback),
  ]);
  const pairs: Record<string, PairRow> = {};
  for (const k of keys) {
    const row: PairRow = {};
    if (s.decisions[k]) row.decision = s.decisions[k];
    if (!isEmptyObj(s.optIns[k])) row.optIn = s.optIns[k];
    if (!isEmptyObj(s.screening[k])) row.screening = s.screening[k];
    if (s.slots[k]) row.slot = s.slots[k];
    if (s.offers[k]) row.offer = s.offers[k];
    if (!isEmptyObj(s.feedback[k])) row.feedback = s.feedback[k];
    if (Object.keys(row).length) pairs[k] = row;
  }
  return {
    pairs,
    audit: s.audit,
    needs: s.needs.filter((n) => n.createdByUser),
    talent: s.talent.filter((t) => t.createdByUser),
  };
}

/** Rows → the store's maps (pipeline part only; cards are merged with the seed by hydrate). */
export function fromSnapshot(snap: Snapshot) {
  const out = {
    decisions: {} as Record<string, Decision>,
    optIns: {} as Record<string, OptIn>,
    slots: {} as Record<string, string>,
    screening: {} as Record<string, Screening>,
    offers: {} as Record<string, Offer>,
    feedback: {} as Record<string, Feedback>,
  };
  for (const [k, r] of Object.entries(snap.pairs)) {
    if (r.decision) out.decisions[k] = r.decision;
    if (r.optIn) out.optIns[k] = r.optIn;
    if (r.slot) out.slots[k] = r.slot;
    if (r.screening) out.screening[k] = r.screening;
    if (r.offer) out.offers[k] = r.offer;
    if (r.feedback) out.feedback[k] = r.feedback;
  }
  return out;
}

/**
 * Key-order-independent JSON: Postgres jsonb reorders object keys, so a row read back from
 * the database must still compare equal to the browser's copy (else every poll would
 * re-save it). Undefined values are dropped, as in JSON.
 */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : stableJson(x))).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

const same = (a: unknown, b: unknown) => stableJson(a ?? null) === stableJson(b ?? null);

/** What changed between two snapshots. The audit log is append-only: only new ids are sent. */
export function diffSnapshot(prev: Snapshot, next: Snapshot): Patch {
  const pairs: Record<string, PairRow | null> = {};
  for (const [k, row] of Object.entries(next.pairs)) if (!same(prev.pairs[k], row)) pairs[k] = row;
  for (const k of Object.keys(prev.pairs)) if (!(k in next.pairs)) pairs[k] = null;
  const seen = new Set(prev.audit.map((e) => e.id));
  const changedCards = <T extends { id: string }>(a: T[], b: T[]) => {
    const before = new Map(a.map((x) => [x.id, x]));
    return b.filter((x) => !same(before.get(x.id), x));
  };
  return {
    pairs,
    audit: next.audit.filter((e) => !seen.has(e.id)),
    needs: changedCards(prev.needs, next.needs),
    talent: changedCards(prev.talent, next.talent),
  };
}

export const patchIsEmpty = (p: Patch) =>
  !Object.keys(p.pairs).length && !p.audit.length && !p.needs.length && !p.talent.length;

/** Apply a patch to a snapshot (what the server now holds after a successful save). */
export function applyPatch(snap: Snapshot, p: Patch): Snapshot {
  const pairs = { ...snap.pairs };
  for (const [k, row] of Object.entries(p.pairs)) {
    if (row) pairs[k] = row;
    else delete pairs[k];
  }
  const merge = <T extends { id: string }>(a: T[], b: T[]) => {
    const ids = new Set(b.map((x) => x.id));
    return [...b, ...a.filter((x) => !ids.has(x.id))];
  };
  const ids = new Set(snap.audit.map((e) => e.id));
  return {
    pairs,
    audit: [...snap.audit, ...p.audit.filter((e) => !ids.has(e.id))],
    needs: merge(snap.needs, p.needs),
    talent: merge(snap.talent, p.talent),
  };
}

// ── Server-side validation of what a browser sends ─────────────────────────────

const ID = /^[A-Za-z0-9_-]{1,64}$/;
export const PAIR_KEY = /^[A-Za-z0-9_-]{1,64}::[A-Za-z0-9_-]{1,64}$/;
const MAX_ROW = 8_000;
const MAX_CARD = 60_000;
const MAX_PAIRS = 2_000;

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 2000) => (typeof v === "string" && v.length <= max ? v : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const TIME = /^\d{2}:\d{2}$/;
const time = (v: unknown) => (typeof v === "string" && TIME.test(v) ? v : undefined);
const prune = <T extends object>(o: T): T | undefined => {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  return Object.keys(out).length ? out : undefined;
};

function cleanSide(v: unknown) {
  if (!obj(v)) return undefined;
  return prune({
    held: bool(v.held) ?? false,
    usefulness: num(v.usefulness),
    accuracy: num(v.accuracy),
    nextStep: ["continue", "keep-in-touch", "stop"].includes(v.nextStep as string)
      ? (v.nextStep as "continue")
      : undefined,
    improve: str(v.improve, 1000),
    at: str(v.at, 40) ?? "",
  });
}

/** Keep only the known fields of a pair row, with the right types. Returns undefined if invalid. */
export function cleanRow(v: unknown): PairRow | undefined {
  if (!obj(v) || JSON.stringify(v).length > MAX_ROW) return undefined;
  const d = obj(v.decision) ? v.decision : undefined;
  const o = obj(v.optIn) ? v.optIn : undefined;
  const sc = obj(v.screening) ? v.screening : undefined;
  const of = obj(v.offer) ? v.offer : undefined;
  const fb = obj(v.feedback) ? v.feedback : undefined;
  return (
    prune({
      decision:
        d && (d.status === "approved" || d.status === "rejected")
          ? {
              status: d.status,
              reason: str(d.reason, 500) ?? "",
              note: str(d.note, 1000),
              at: str(d.at, 40) ?? "",
            }
          : undefined,
      optIn: o ? prune({ company: bool(o.company), talent: bool(o.talent) }) : undefined,
      screening: sc
        ? prune({
            answer: bool(sc.answer),
            slot: time(sc.slot),
            result: sc.result === "passed" || sc.result === "not-passed" ? sc.result : undefined,
            reason: str(sc.reason, 500),
            note: str(sc.note, 1000),
            at: str(sc.at, 40),
          })
        : undefined,
      slot: time(v.slot),
      offer:
        of && (of.status === "offered" || of.status === "no-offer")
          ? prune({
              status: of.status,
              note: str(of.note, 1000),
              at: str(of.at, 40) ?? "",
              answer: bool(of.answer),
              answeredAt: str(of.answeredAt, 40),
            })
          : undefined,
      feedback: fb ? prune({ company: cleanSide(fb.company), talent: cleanSide(fb.talent) }) : undefined,
    }) ?? {}
  );
}

const AUDIT_ACTIONS = new Set(["approved", "rejected", "edited", "reverted", "passed", "not-passed"]);
const AUDIT_STATUS = new Set(["approved", "rejected", "none", "passed", "not-passed"]);

export function cleanAudit(v: unknown): AuditEntry | undefined {
  if (!obj(v)) return undefined;
  const e = {
    id: str(v.id, 80),
    at: str(v.at, 40),
    actor: str(v.actor, 80),
    action: v.action,
    needId: str(v.needId, 64),
    talentId: str(v.talentId, 64),
    from: v.from,
    to: v.to,
    reason: str(v.reason, 500),
    note: str(v.note, 1000),
  };
  if (!e.id || !e.at || Number.isNaN(Date.parse(e.at)) || !e.actor || !e.needId || !e.talentId)
    return undefined;
  if (
    !AUDIT_ACTIONS.has(e.action as string) ||
    !AUDIT_STATUS.has(e.from as string) ||
    !AUDIT_STATUS.has(e.to as string)
  )
    return undefined;
  if (e.reason === undefined) return undefined;
  return e as AuditEntry;
}

/** A card the user created: must be marked createdByUser, have a valid id and stay small. */
function cleanCard<T extends { id: string; createdByUser?: boolean }>(v: unknown): T | undefined {
  if (!obj(v) || typeof v.id !== "string" || !ID.test(v.id) || v.createdByUser !== true) return undefined;
  return JSON.stringify(v).length <= MAX_CARD ? (v as T) : undefined;
}

/** Validate a whole patch from a browser. Invalid entries are dropped, never trusted. */
export function cleanPatch(v: unknown): Patch | null {
  if (!obj(v)) return null;
  const pairs: Record<string, PairRow | null> = {};
  const rawPairs = obj(v.pairs) ? Object.entries(v.pairs) : [];
  if (rawPairs.length > MAX_PAIRS) return null;
  for (const [k, row] of rawPairs) {
    if (!PAIR_KEY.test(k)) continue;
    if (row === null) pairs[k] = null;
    else {
      const r = cleanRow(row);
      if (r) pairs[k] = Object.keys(r).length ? r : null;
    }
  }
  const list = (x: unknown) => (Array.isArray(x) ? x.slice(0, MAX_PAIRS) : []);
  return {
    pairs,
    audit: list(v.audit)
      .map(cleanAudit)
      .filter((e): e is AuditEntry => !!e),
    needs: list(v.needs)
      .map((x) => cleanCard<Need>(x))
      .filter((x): x is Need => !!x),
    talent: list(v.talent)
      .map((x) => cleanCard<Talent>(x))
      .filter((x): x is Talent => !!x),
  };
}
