"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SEED_NEEDS, SEED_TALENT } from "./data";
import { pairKey } from "./match";
import type { Decision, Feedback, Need, Talent } from "./types";

type OptIn = { company?: boolean; talent?: boolean };

type DemoState = {
  needs: Need[];
  talent: Talent[];
  decisions: Record<string, Decision>;
  optIns: Record<string, OptIn>;
  slots: Record<string, string>;
  feedback: Record<string, Feedback>;
};

const SEED_STATE: DemoState = {
  needs: SEED_NEEDS,
  talent: SEED_TALENT,
  decisions: {
    [pairKey("N-01", "T-30")]: {
      status: "approved",
      note: "Strong pipeline evidence; ask about battery domain interest.",
      at: "2026-11-10T09:12:00.000Z",
    },
    [pairKey("N-02", "T-12")]: {
      status: "approved",
      note: "Career changer with real ops data experience — worth a conversation.",
      at: "2026-11-11T13:40:00.000Z",
    },
  },
  optIns: {
    [pairKey("N-01", "T-30")]: { company: true },
    [pairKey("N-02", "T-12")]: { company: true, talent: true },
  },
  slots: { [pairKey("N-02", "T-12")]: "10:20" },
  feedback: {},
};

// Bump when seeds change so stale persisted state does not hide new personas.
const STORAGE_KEY = "truefit-demo-v2";

type Ctx = DemoState & {
  addNeed: (n: Need) => void;
  addTalent: (t: Talent) => void;
  decide: (key: string, d: Omit<Decision, "at">) => void;
  undoDecision: (key: string) => void;
  setOptIn: (key: string, side: "company" | "talent", value: boolean) => void;
  bookSlot: (key: string, slot: string) => void;
  giveFeedback: (key: string, f: Feedback) => void;
  reset: () => void;
};

const DemoContext = createContext<Ctx | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState>(SEED_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted demo state after mount
      if (raw) setState({ ...SEED_STATE, ...JSON.parse(raw) });
    } catch {
      /* storage unavailable: run from seed */
    }
    setLoaded(true);
  }, []);

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
      setState((s) => ({
        ...s,
        decisions: { ...s.decisions, [key]: { ...d, at: new Date().toISOString() } },
      })),
    [],
  );
  const undoDecision = useCallback(
    (key: string) =>
      setState((s) => {
        const decisions = { ...s.decisions };
        delete decisions[key];
        return { ...s, decisions };
      }),
    [],
  );
  const setOptIn = useCallback(
    (key: string, side: "company" | "talent", value: boolean) =>
      setState((s) => ({ ...s, optIns: { ...s.optIns, [key]: { ...s.optIns[key], [side]: value } } })),
    [],
  );
  const bookSlot = useCallback(
    (key: string, slot: string) => setState((s) => ({ ...s, slots: { ...s.slots, [key]: slot } })),
    [],
  );
  const giveFeedback = useCallback(
    (key: string, f: Feedback) => setState((s) => ({ ...s, feedback: { ...s.feedback, [key]: f } })),
    [],
  );
  const reset = useCallback(() => setState(SEED_STATE), []);

  const value = useMemo(
    () => ({ ...state, addNeed, addTalent, decide, undoDecision, setOptIn, bookSlot, giveFeedback, reset }),
    [state, addNeed, addTalent, decide, undoDecision, setOptIn, bookSlot, giveFeedback, reset],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}
