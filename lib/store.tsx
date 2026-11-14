"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { OWN_COMPANY } from "./data";
import {
  applyPatch,
  diffSnapshot,
  EMPTY_SNAPSHOT,
  fromSnapshot,
  patchIsEmpty,
  toSnapshot,
  type Snapshot,
} from "./demo-state";
import { setEsco, type EscoSnapshot } from "./esco";
import { pairKey } from "./match";
import { actionFor, auditEntry } from "./oversight";
import type { Offer, Screening } from "./pipeline";
import { withOptIn, type OptIn, type OptInAnswer } from "./schedule";
import { setSeed, type Seed } from "./seed";
import type { AuditEntry, Decision, Feedback, FeedbackSide, Need, SideFeedback, Talent } from "./types";

type DemoState = {
  needs: Need[];
  talent: Talent[];
  decisions: Record<string, Decision>;
  /** Append-only: every approve, reject, edit and revert, never removed. */
  audit: AuditEntry[];
  optIns: Record<string, OptIn>;
  /** Company interview times. */
  slots: Record<string, string>;
  /** Espoo interview per pair: the candidate's answer, the time and the organiser's result. */
  screening: Record<string, Screening>;
  /** The company's job offer (or no offer) and the candidate's answer. */
  offers: Record<string, Offer>;
  feedback: Record<string, Feedback>;
};

const SEED_DECISIONS: Record<string, Decision> = {
  [pairKey("N-01", "T-30")]: {
    status: "approved",
    reason: "Must-haves shown in their answers",
    note: "Strong pipeline evidence; ask about battery domain interest.",
    at: "2026-11-10T09:12:00.000Z",
  },
  [pairKey("N-02", "T-12")]: {
    status: "approved",
    reason: "Strong transferable skills",
    note: "Career changer with real ops data experience — worth a conversation.",
    at: "2026-11-11T13:40:00.000Z",
  },
};

const SEED_SCREENING: Record<string, Screening> = {
  [pairKey("N-01", "T-30")]: {
    answer: true,
    slot: "2026-11-30 10:00",
    result: "passed",
    reason: "Skills confirmed in the interview",
    at: "2026-11-12T10:30:00.000Z",
  },
  [pairKey("N-02", "T-12")]: {
    answer: true,
    slot: "2026-11-30 09:30",
    result: "passed",
    reason: "Transferable skills confirmed",
    note: "Clear examples of cleaning messy operations data.",
    at: "2026-11-12T11:15:00.000Z",
  },
};

/** Seed rows the server loaded from the database (lib/seed-db.ts). */
export type DemoSeed = Seed;

const seedState = ({ needs, talent }: Pick<Seed, "needs" | "talent">): DemoState => ({
  needs,
  talent,
  decisions: SEED_DECISIONS,
  audit: [
    ...Object.entries(SEED_DECISIONS).map(([key, d]) =>
      auditEntry(key, "approved", "none", "approved", d.reason, d.note, d.at),
    ),
    ...Object.entries(SEED_SCREENING).map(([key, sc]) =>
      auditEntry(key, "passed", "approved", "passed", sc.reason!, sc.note, sc.at),
    ),
  ],
  optIns: {
    [pairKey("N-01", "T-30")]: { company: true },
    [pairKey("N-02", "T-12")]: { company: true, talent: true },
  },
  slots: { [pairKey("N-02", "T-12")]: "2026-12-01 10:30" },
  // Both seeded candidates already passed their Espoo interview, so the company sees them.
  screening: SEED_SCREENING,
  offers: {},
  // Demo data: the one meeting already booked, as if both sides answered after the event.
  feedback: {
    [pairKey("N-02", "T-12")]: {
      company: {
        held: true,
        usefulness: 5,
        accuracy: 4,
        nextStep: "continue",
        improve: "Send the skill cards a day earlier so we can prepare questions.",
        at: "2026-12-03T10:35:00.000Z",
      },
      talent: {
        held: true,
        usefulness: 4,
        accuracy: 5,
        nextStep: "continue",
        improve: "A quiet corner for meetings would help, the hall was loud.",
        at: "2026-12-03T10:40:00.000Z",
      },
    },
  },
});

// Bump when the state's shape changes so stale persisted state is dropped.
const STORAGE_KEY = "truefit-demo-v6";

/**
 * Restore persisted demo state over the fresh seed. Seed needs and talent always come from
 * the server (database or JSON), so a browser that saved an older copy (e.g. before contact
 * details existed) still sees the current rows; only what the user created is restored.
 */
export function hydrate(initial: DemoState, saved: Partial<DemoState>): DemoState {
  const mine = <T extends { id: string; createdByUser?: boolean }>(rows: T[] | undefined, seed: T[]) => {
    const own = (rows ?? []).filter((r) => r.createdByUser);
    const ids = new Set(own.map((r) => r.id));
    return [...own, ...seed.filter((r) => !ids.has(r.id))];
  };
  return {
    ...initial,
    ...saved,
    // Needs saved before the demo company had a name pick up the current one.
    needs: mine(saved.needs, initial.needs).map((n) =>
      n.createdByUser && n.companyId === OWN_COMPANY.id
        ? { ...n, company: OWN_COMPANY.name, companyBlurb: OWN_COMPANY.blurb }
        : n,
    ),
    talent: mine(saved.talent, initial.talent),
  };
}

/**
 * When the organiser passes on a pair or undoes its invitation, everything after the
 * assessment goes too (Espoo interview, company interview, offer). Requests and feedback stay.
 */
function withoutDownstream(s: DemoState, key: string): DemoState {
  const screening = { ...s.screening };
  const slots = { ...s.slots };
  const offers = { ...s.offers };
  delete screening[key];
  delete slots[key];
  delete offers[key];
  return { ...s, screening, slots, offers };
}

/** Where the shared database copy stands: loading, saved, saving, or not reachable. */
export type SyncStatus = "loading" | "saved" | "saving" | "error";

const POLL_MS = 4000;

type Ctx = DemoState & {
  sync: SyncStatus;
  addNeed: (n: Need) => void;
  addTalent: (t: Talent) => void;
  /** Approve, reject or edit a pair's decision. Always logged with a reason. */
  decide: (key: string, d: Omit<Decision, "at">) => void;
  /** Withdraw a decision (back to undecided). Logged, never erased. */
  undoDecision: (key: string, reason: string) => void;
  /** true = yes, false = declined, undefined = clear. Anything but a yes frees a booked slot. */
  setOptIn: (key: string, side: "company" | "talent", value: OptInAnswer) => void;
  bookSlot: (key: string, slot: string) => void;
  cancelSlot: (key: string) => void;
  /** Save one side's feedback for a meeting; the other side's answer is kept. */
  giveFeedback: (key: string, side: FeedbackSide, f: SideFeedback) => void;
  /** Candidate's answer to Espoo's interview invitation. A no or a withdrawal frees the time. */
  answerScreening: (key: string, value: OptInAnswer) => void;
  /** Book (or, with undefined, cancel) the Espoo interview time. */
  bookScreening: (key: string, slot: string | undefined) => void;
  /** The organiser records the Espoo interview result, with a reason; undefined withdraws it. Logged. */
  recordScreening: (key: string, result: Screening["result"], reason: string, note?: string) => void;
  /** The company's offer decision (undefined withdraws it), or the candidate's answer to an offer. */
  setOffer: (key: string, offer: Offer | undefined) => void;
  answerOffer: (key: string, value: OptInAnswer) => void;
  reset: () => void;
};

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({
  children,
  seed,
  esco,
}: {
  children: React.ReactNode;
  seed: DemoSeed;
  esco: EscoSnapshot;
}) {
  // Fill the browser's registries (lib/esco.ts, lib/seed.ts) before any child renders:
  // the matching helpers read them synchronously. Idempotent, so safe during render.
  setEsco(esco);
  setSeed(seed);
  const initial = useMemo(() => seedState(seed), [seed]);
  const [state, setState] = useState<DemoState>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted demo state after mount
      if (raw) setState(hydrate(initial, JSON.parse(raw)));
    } catch {
      /* storage unavailable: run from seed */
    }
    setLoaded(true);
  }, [initial]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, loaded]);

  const addNeed = useCallback(
    (n: Need) => setState((s) => ({ ...s, needs: [n, ...s.needs.filter((x) => x.id !== n.id)] })),
    [],
  );
  const addTalent = useCallback(
    (t: Talent) => setState((s) => ({ ...s, talent: [t, ...s.talent.filter((x) => x.id !== t.id)] })),
    [],
  );
  const decide = useCallback(
    (key: string, d: Omit<Decision, "at">) =>
      setState((s) => {
        const at = new Date().toISOString();
        const prev = s.decisions[key];
        const entry = auditEntry(
          key,
          actionFor(prev, d.status),
          prev?.status ?? "none",
          d.status,
          d.reason,
          d.note,
          at,
        );
        const next = { ...s, decisions: { ...s.decisions, [key]: { ...d, at } }, audit: [...s.audit, entry] };
        return d.status === "rejected" ? withoutDownstream(next, key) : next;
      }),
    [],
  );
  const undoDecision = useCallback(
    (key: string, reason: string) =>
      setState((s) => {
        const prev = s.decisions[key];
        if (!prev) return s;
        const decisions = { ...s.decisions };
        delete decisions[key];
        return withoutDownstream(
          { ...s, decisions, audit: [...s.audit, auditEntry(key, "reverted", prev.status, "none", reason)] },
          key,
        );
      }),
    [],
  );
  const setOptIn = useCallback(
    (key: string, side: "company" | "talent", value: OptInAnswer) =>
      setState((s) => ({ ...s, ...withOptIn(s.optIns, s.slots, key, side, value) })),
    [],
  );
  const bookSlot = useCallback(
    (key: string, slot: string) => setState((s) => ({ ...s, slots: { ...s.slots, [key]: slot } })),
    [],
  );
  const cancelSlot = useCallback(
    (key: string) =>
      setState((s) => {
        const slots = { ...s.slots };
        delete slots[key];
        return { ...s, slots };
      }),
    [],
  );
  const giveFeedback = useCallback(
    (key: string, side: FeedbackSide, f: SideFeedback) =>
      setState((s) => ({ ...s, feedback: { ...s.feedback, [key]: { ...s.feedback[key], [side]: f } } })),
    [],
  );
  const answerScreening = useCallback(
    (key: string, value: OptInAnswer) =>
      setState((s) => {
        const prev = s.screening[key] ?? {};
        const sc: Screening = { ...prev, answer: value, ...(value !== true && { slot: undefined }) };
        return { ...s, screening: { ...s.screening, [key]: sc } };
      }),
    [],
  );
  const bookScreening = useCallback(
    (key: string, slot: string | undefined) =>
      setState((s) => ({ ...s, screening: { ...s.screening, [key]: { ...s.screening[key], slot } } })),
    [],
  );
  const recordScreening = useCallback(
    (key: string, result: Screening["result"], reason: string, note?: string) =>
      setState((s) => {
        const prev = s.screening[key] ?? {};
        const at = new Date().toISOString();
        const entry = auditEntry(
          key,
          result ?? "reverted",
          prev.result ?? "approved",
          result ?? "approved",
          reason,
          note,
          at,
        );
        const sc: Screening = { ...prev, result, reason: result && reason, note: result && note?.trim(), at };
        const next = { ...s, screening: { ...s.screening, [key]: sc }, audit: [...s.audit, entry] };
        // Without a pass, nothing reaches the company: drop its interview and offer for this pair.
        if (result === "passed") return next;
        const slots = { ...next.slots };
        const offers = { ...next.offers };
        delete slots[key];
        delete offers[key];
        return { ...next, slots, offers };
      }),
    [],
  );
  const setOffer = useCallback(
    (key: string, offer: Offer | undefined) =>
      setState((s) => {
        const offers = { ...s.offers };
        if (offer) offers[key] = offer;
        else delete offers[key];
        return { ...s, offers };
      }),
    [],
  );
  const answerOffer = useCallback(
    (key: string, value: OptInAnswer) =>
      setState((s) => {
        const prev = s.offers[key];
        if (!prev) return s;
        const offer = {
          ...prev,
          answer: value,
          answeredAt: value === undefined ? undefined : new Date().toISOString(),
        };
        return { ...s, offers: { ...s.offers, [key]: offer } };
      }),
    [],
  );
  // ── Database sync (app/api/demo-state) ──────────────────────────────────────
  // The database is the shared copy: every browser loads it, saves its own changes per pair,
  // and polls for other people's. localStorage only gives a fast first paint.
  const [sync, setSync] = useState<SyncStatus>("loading");
  const [tick, setTick] = useState(0);
  const stateRef = useRef(state);
  const syncedRef = useRef<Snapshot | null>(null); // what the database holds, as far as we know
  const versionRef = useRef(0);
  const busyRef = useRef(false);
  const againRef = useRef(false);
  const discardRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applyRemote = useCallback(
    (snap: Snapshot) =>
      setState(
        hydrate(initial, {
          ...fromSnapshot(snap),
          audit: snap.audit,
          needs: snap.needs,
          talent: snap.talent,
        }),
      ),
    [initial],
  );

  const pull = useCallback(
    async (force = false) => {
      // After a refused save: take the shared copy even over unsaved local changes.
      const discardLocal = discardRef.current;
      discardRef.current = false;
      const res = await fetch(`/api/demo-state${force ? "" : `?since=${versionRef.current}`}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Database error");
      if (data.unchanged) return;
      // Never drop unsaved local changes: they are saved first, then the next poll catches up.
      if (busyRef.current && !discardLocal) return;
      const pending =
        syncedRef.current && !patchIsEmpty(diffSnapshot(syncedRef.current, toSnapshot(stateRef.current)));
      if (pending && !data.empty && !discardLocal) return;
      versionRef.current = data.version;
      if (data.empty) {
        // First run against an empty database: write the starting state (seed + this browser's).
        syncedRef.current = EMPTY_SNAPSHOT;
        setTick((t) => t + 1);
      } else {
        syncedRef.current = data.snapshot;
        applyRemote(data.snapshot);
      }
      setSync("saved");
    },
    [applyRemote],
  );

  const save = useCallback(async () => {
    if (!syncedRef.current) return;
    if (busyRef.current) {
      againRef.current = true;
      return;
    }
    const patch = diffSnapshot(syncedRef.current, toSnapshot(stateRef.current));
    if (patchIsEmpty(patch)) return;
    busyRef.current = true;
    setSync("saving");
    try {
      const res = await fetch("/api/demo-state", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      // Not this account's to change (e.g. local edits left from another account): drop them
      // and take the shared copy below, rather than retrying forever.
      if (res.status === 403) {
        // Not this account's to change (e.g. local edits left from another account): drop
        // the local copy for the shared one below, rather than retrying forever.
        discardRef.current = true;
        throw new Error(data.error ?? "Not allowed");
      }
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      syncedRef.current = applyPatch(syncedRef.current, patch);
      // Someone else saved in between: reload after this, so their changes aren't skipped.
      const missed = data.version !== versionRef.current + 1;
      versionRef.current = missed ? versionRef.current : data.version;
      setSync("saved");
      if (missed) againRef.current = true;
    } catch {
      setSync(discardRef.current ? "saving" : "error");
    } finally {
      busyRef.current = false;
      if (discardRef.current) void pull(true).catch(() => setSync("error"));
      else if (againRef.current) {
        againRef.current = false;
        void save().then(() => pull().catch(() => setSync("error")));
      }
    }
  }, [pull]);

  // Load once the local copy is in place.
  useEffect(() => {
    if (!loaded) return;
    pull(true).catch(() => setSync("error"));
  }, [loaded, pull]);

  // Save changes shortly after they happen.
  useEffect(() => {
    if (!loaded || !syncedRef.current) return;
    const t = setTimeout(() => void save(), 400);
    return () => clearTimeout(t);
  }, [state, loaded, tick, save]);

  // Pick up other people's changes: poll while the tab is visible, and on focus.
  useEffect(() => {
    if (!loaded) return;
    const poll = () => {
      if (document.visibilityState !== "visible" || !syncedRef.current) return;
      // Retry anything a failed save left behind, then fetch other people's changes.
      save()
        .then(() => pull())
        .catch(() => setSync("error"));
    };
    const id = window.setInterval(poll, POLL_MS);
    window.addEventListener("focus", poll);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", poll);
    };
  }, [loaded, pull, save]);

  const reset = useCallback(() => {
    syncedRef.current = null; // pause saving until the database is emptied
    setState(initial);
    setSync("saving");
    fetch("/api/demo-state", { method: "DELETE" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        versionRef.current = data.version;
        syncedRef.current = EMPTY_SNAPSHOT; // the save effect now writes the fresh seed
        setTick((t) => t + 1);
      })
      .catch(() => setSync("error"));
  }, [initial]);

  const value = useMemo(
    () => ({
      ...state,
      sync,
      addNeed,
      addTalent,
      decide,
      undoDecision,
      setOptIn,
      bookSlot,
      cancelSlot,
      giveFeedback,
      answerScreening,
      bookScreening,
      recordScreening,
      setOffer,
      answerOffer,
      reset,
    }),
    [
      sync,
      answerScreening,
      bookScreening,
      recordScreening,
      setOffer,
      answerOffer,
      state,
      addNeed,
      addTalent,
      decide,
      undoDecision,
      setOptIn,
      bookSlot,
      cancelSlot,
      giveFeedback,
      reset,
    ],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}
