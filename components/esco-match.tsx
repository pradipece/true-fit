"use client";

import { ExternalLinkIcon, LandmarkIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillChip } from "@/components/skill-chip";
import type { EscoLookup } from "@/lib/talent-ai";

/** The official ESCO occupation for a job title, live from the ESCO API. */
export function EscoMatch({
  lookup,
  picked,
  onToggle,
  onAddAll,
}: {
  lookup?: EscoLookup;
  picked: string[];
  onToggle: (id: string) => void;
  onAddAll: (ids: string[]) => void;
}) {
  if (!lookup || lookup.status === "skipped") return null;
  if (lookup.status !== "found")
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LandmarkIcon className="size-3.5" />
        {lookup.status === "none"
          ? "No direct match in the official ESCO classification; the skills below come from your words."
          : "The ESCO service isn't reachable right now, so this uses the cached skill set."}
      </p>
    );

  const o = lookup.occupation;
  const linked = [...new Map(o.essential.filter((s) => s.subset).map((s) => [s.subset!.id, s])).values()];
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <LandmarkIcon className="size-3.5" /> Official ESCO occupation (live from the EU&apos;s ESCO API)
          </p>
          <p className="text-sm font-medium first-letter:uppercase">{o.labels.en}</p>
          <p className="text-xs text-muted-foreground">
            {[o.labels.fi && `fi: ${o.labels.fi}`, o.labels.sv && `sv: ${o.labels.sv}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <a
          href={o.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
        >
          View on ESCO <ExternalLinkIcon className="size-3" />
        </a>
      </div>
      {o.description && <p className="line-clamp-2 text-xs text-muted-foreground">{o.description}</p>}
      {o.regulated && (
        <p className="text-xs text-transfer">
          ESCO marks this as a regulated profession: working in Finland may need recognition of the
          qualification.
        </p>
      )}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {o.essential.length} essential skills in ESCO · {linked.length} map to this event&apos;s skills
          </p>
          {linked.length > 0 && (
            <Button size="xs" variant="secondary" onClick={() => onAddAll(linked.map((s) => s.subset!.id))}>
              <PlusIcon data-icon="inline-start" /> Add all
            </Button>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {linked.slice(0, 8).map((s) => (
            <li key={s.uri}>
              <button
                type="button"
                onClick={() => onToggle(s.subset!.id)}
                aria-pressed={picked.includes(s.subset!.id)}
                title={`ESCO: ${s.title}${s.subset!.via === "keyword" ? " (close match)" : ""}`}
              >
                <SkillChip id={s.subset!.id} kind={picked.includes(s.subset!.id) ? "claimed" : "neutral"} />
              </button>
            </li>
          ))}
        </ul>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">
            All ESCO essential skills
          </summary>
          <p className="mt-1 leading-relaxed">{o.essential.map((s) => s.title).join(" · ")}</p>
        </details>
      </div>
      {lookup.others.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Also close in ESCO: {lookup.others.map((x) => x.title).join(", ")}
        </p>
      )}
    </div>
  );
}
