"use client";

import { useSyncExternalStore } from "react";
import { CircleHelpIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "How this works" strip under a page title: three short, numbered steps in plain words.
 * People can hide it; the choice is remembered per page in this browser only.
 */

const EVENT_NAME = "truefit-guide";
const storageKey = (id: string) => `truefit-guide-hidden:${id}`;

function readHidden(id: string) {
  try {
    return localStorage.getItem(storageKey(id)) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT_NAME, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export type GuideStep = { title: string; text: string };

export function PageGuide({ id, steps }: { id: string; steps: GuideStep[] }) {
  const hidden = useSyncExternalStore(
    subscribe,
    () => readHidden(id),
    () => false,
  );

  const setHidden = (value: boolean) => {
    try {
      if (value) localStorage.setItem(storageKey(id), "1");
      else localStorage.removeItem(storageKey(id));
    } catch {
      // Storage blocked: the guide just reappears on the next visit.
    }
    window.dispatchEvent(new Event(EVENT_NAME));
  };

  if (hidden) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-mt-2 text-muted-foreground"
        onClick={() => setHidden(false)}
      >
        <CircleHelpIcon data-icon="inline-start" /> How this page works
      </Button>
    );
  }

  return (
    <section aria-label="How this page works" className="relative rounded-xl border bg-accent/40 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <CircleHelpIcon className="size-4 text-primary" /> How this page works
        </h2>
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setHidden(true)}>
          <XIcon data-icon="inline-start" /> Hide
        </Button>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 space-y-0.5">
              <span className="block text-sm font-medium">{s.title}</span>
              <span className="block text-sm leading-snug text-muted-foreground">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
