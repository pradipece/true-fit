"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SEED_NEEDS, SEED_TALENT } from "./data";
import { pairKey } from "./match";
import { actionFor, auditEntry } from "./oversight";
import { withOptIn, type OptIn, type OptInAnswer } from "./schedule";
import type { AuditEntry, Decision, Feedback, FeedbackSide, Need, SideFeedback, Talent } from "./types";

type DemoState = {
  needs: Need[];
  talent: Talent[];
  decisions: Record<string, Decision>;
  /** Append-only: every approve, reject, edit and revert, never removed. */
  audit: AuditEntry[];
  optIns: Record<string, OptIn>;
  slots: Record<string, string>;
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

/** Seed rows the server loaded (Supabase, or the JSON seeds as fallback). */
export type DemoSeed = { needs: Need[]; talent: Talent[] };

const seedState = ({ needs, talent }: DemoSeed = { needs: SEED_NEEDS, talent: SEED_TALENT }): DemoState => ({
  needs,
  talent,
  decisions: SEED_DECISIONS,
  audit: Object.entries(SEED_DECISIONS).map(([key, d]) =>
    auditEntry(key, "approved", "none", "approved", d.reason, d.note, d.at),
  ),
  optIns: {
    [pairKey("N-01", "T-30")]: { company: true },
    [pairKey("N-02", "T-12")]: { company: true, talent: true },
  },
  slots: { [pairKey("N-02", "T-12")]: "10:20" },
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

// Bump when seeds change so stale persisted state does not hide new personas.
const STORAGE_KEY = "truefit-demo-v4";

type Ctx = DemoState & {
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
  reset: () => void;
};

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children, seed }: { children: React.ReactNode; seed?: DemoSeed }) {
  const initial = useMemo(() => seedState(seed), [seed]);
  const [state, setState] = useState<DemoState>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted demo state after mount
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
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
        return { ...s, decisions: { ...s.decisions, [key]: { ...d, at } }, audit: [...s.audit, entry] };
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
        return {
          ...s,
          decisions,
          audit: [...s.audit, auditEntry(key, "reverted", prev.status, "none", reason)],
        };
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
  const reset = useCallback(() => setState(initial), [initial]);

  const value = useMemo(
    () => ({
      ...state,
      addNeed,
      addTalent,
      decide,
      undoDecision,
      setOptIn,
      bookSlot,
      cancelSlot,
      giveFeedback,
      reset,
    }),
    [state, addNeed, addTalent, decide, undoDecision, setOptIn, bookSlot, cancelSlot, giveFeedback, reset],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}
