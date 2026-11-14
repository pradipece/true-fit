"use client";

import { BriefcaseIcon, ClockIcon, LanguagesIcon, MapPinIcon } from "lucide-react";
import { modeKind } from "@/lib/need-terms";
import type { Need } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Job-board building blocks shared by the home page and Find jobs. Display only, never scored. */

const LOGO_TONES = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
];

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** A company's "logo": its initials on a stable colour. */
export function CompanyLogo({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÅÄÖåäö]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold",
        LOGO_TONES[hash(name) % LOGO_TONES.length],
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

/** "Hybrid · Espoo", the language, and the contract, as a compact meta line. */
export function JobMeta({ need, className }: { need: Need; className?: string }) {
  const kind = modeKind(need.mode);
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      <span className="flex items-center gap-1">
        <MapPinIcon className="size-3.5" />
        {kind === "Remote" ? need.mode : `${need.mode} · Espoo`}
      </span>
      <span className="flex items-center gap-1">
        <LanguagesIcon className="size-3.5" />
        {need.language}
      </span>
      {need.timing && (
        <span className="flex items-center gap-1">
          <BriefcaseIcon className="size-3.5" />
          {need.timing.engagement}
        </span>
      )}
      {need.timing && (
        <span className="flex items-center gap-1">
          <ClockIcon className="size-3.5" />
          Starts {need.timing.start}
        </span>
      )}
    </p>
  );
}

/** When the role was posted, relative to the event. */
export const postedLabel = (n: Need) =>
  n.createdByUser || n.submittedWeeksBefore <= 0
    ? "New"
    : `Posted ${n.submittedWeeksBefore} week${n.submittedWeeksBefore === 1 ? "" : "s"} before the event`;

/** Simple keyword search over what a job seeker reads on a listing. */
export function jobMatchesQuery(n: Need, q: string, skillName: (id: string) => string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = [
    n.title,
    n.company,
    n.summary,
    n.mode,
    n.language,
    ...n.must.map(skillName),
    ...n.nice.map(skillName),
  ]
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}
