"use client";

import { useState } from "react";
import { BarChart3Icon, TableIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Small, dependency-free chart pieces for the dashboard. Thin marks with rounded data
 * ends, recessive grids, a hover tooltip on every mark, a legend whenever there are two
 * or more series, and a table view of the same numbers on every card.
 */

export type Series = { key: string; label: string; color: string };

/** Validated categorical order (light and dark), from the --chart-* tokens. */
export const CHART = {
  blue: "var(--chart-1)",
  green: "var(--chart-2)",
  amber: "var(--chart-3)",
  magenta: "var(--chart-4)",
};

export type TableView = { columns: string[]; rows: (string | number)[][] };

export function ChartCard({
  title,
  description,
  legend,
  table,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  legend?: Series[];
  table: TableView;
  className?: string;
  children: React.ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="col-start-2 row-span-2 row-start-1 flex items-center gap-1 self-start justify-self-end rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-pressed={asTable}
        >
          {asTable ? <BarChart3Icon className="size-3.5" /> : <TableIcon className="size-3.5" />}
          {asTable ? "Chart" : "Table"}
        </button>
      </CardHeader>
      <CardContent className="space-y-4">
        {legend && legend.length > 1 && !asTable && <Legend series={legend} />}
        {asTable ? <DataTable {...table} /> : children}
      </CardContent>
    </Card>
  );
}

function DataTable({ columns, rows }: TableView) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((c, i) => (
            <TableHead key={c} className={cn(i > 0 && "text-right")}>
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>
            {r.map((v, j) => (
              <TableCell key={j} className={cn(j > 0 && "text-right tabular-nums")}>
                {v}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Hover / focus target with a tooltip. The target is larger than the mark it wraps. */
function Tip({
  tip,
  className,
  children,
}: {
  tip: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<div tabIndex={0} />}
        className={cn("rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/** One series of horizontal bars. Values are written out, so color is never the only cue. */
export function HBars({
  rows,
  max,
  color = CHART.blue,
  format = (n) => String(n),
  reference,
}: {
  rows: { key: string; label: React.ReactNode; sub?: string; value: number; tip: React.ReactNode }[];
  max: number;
  color?: string;
  format?: (n: number) => string;
  /** Optional vertical reference line (same units as value) with a label. */
  reference?: { value: number; label: string };
}) {
  const w = (v: number) => (max ? Math.min(100, (v / max) * 100) : 0);
  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <Tip key={r.key} tip={r.tip} className="-mx-1.5 block px-1.5 py-1 hover:bg-muted/60">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {r.label}
              {r.sub && <span className="text-xs text-muted-foreground"> · {r.sub}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{format(r.value)}</span>
          </div>
          <div className="relative mt-1 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full transition-[width]"
              style={{ width: `${r.value ? Math.max(w(r.value), 1.5) : 0}%`, background: color }}
            />
            {reference && (
              <span
                className="absolute -top-1 -bottom-1 w-px bg-foreground/50"
                style={{ left: `${w(reference.value)}%` }}
                aria-hidden
              />
            )}
          </div>
        </Tip>
      ))}
      {reference && (
        <p className="pt-1 text-xs text-muted-foreground">
          <span className="mr-1 inline-block h-3 w-px translate-y-0.5 bg-foreground/50" aria-hidden />
          {reference.label}
        </p>
      )}
    </div>
  );
}

/** Stacked horizontal bars, one row per item, a 2px gap between segments. */
export function StackedHBars({
  series,
  rows,
}: {
  series: Series[];
  rows: { key: string; label: string; sub?: string; values: Record<string, number> }[];
}) {
  const max = Math.max(1, ...rows.map((r) => series.reduce((s, x) => s + (r.values[x.key] ?? 0), 0)));
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const total = series.reduce((s, x) => s + (r.values[x.key] ?? 0), 0);
        return (
          <Tip
            key={r.key}
            className="-mx-1.5 block px-1.5 py-1 hover:bg-muted/60"
            tip={
              <span className="space-y-0.5">
                <span className="block font-medium">{r.label}</span>
                {series.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                    {s.label}: {r.values[s.key] ?? 0}
                  </span>
                ))}
              </span>
            }
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                {r.label}
                {r.sub && <span className="text-xs text-muted-foreground"> · {r.sub}</span>}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{total}</span>
            </div>
            <div className="mt-1 flex h-2 gap-0.5" style={{ width: `${(total / max) * 100}%` }}>
              {series.map((s) => {
                const v = r.values[s.key] ?? 0;
                return v ? (
                  <span
                    key={s.key}
                    className="h-2 first:rounded-l-full last:rounded-r-full"
                    style={{ flexGrow: v, background: s.color }}
                  />
                ) : null;
              })}
            </div>
          </Tip>
        );
      })}
    </div>
  );
}

/** Vertical columns over an ordered axis (e.g. times of day), with a recessive grid. */
export function Columns({
  items,
  max,
  color = CHART.blue,
  unit,
}: {
  items: { key: string; label: string; value: number; tip: React.ReactNode }[];
  max: number;
  color?: string;
  unit: string;
}) {
  const top = Math.max(1, max);
  const ticks = top % 2 === 0 ? [0, top / 2, top] : [0, top];
  return (
    <div className="grid grid-cols-[1.25rem_1fr] gap-x-2">
      <div className="relative h-64 text-right text-[10px] text-muted-foreground tabular-nums" aria-hidden>
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute right-0 translate-y-1/2"
            style={{ bottom: `${(t / top) * 100}%` }}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="relative h-64">
        {ticks.map((t) => (
          <span
            key={t}
            className="pointer-events-none absolute inset-x-0 border-t border-border/70"
            style={{ bottom: `${(t / top) * 100}%` }}
            aria-hidden
          />
        ))}
        <ul className="relative flex h-full items-end gap-1" aria-label={unit}>
          {items.map((it) => (
            <li
              key={it.key}
              className="h-full min-w-0 flex-1"
              aria-label={`${it.label}: ${it.value} ${unit}`}
            >
              <Tip tip={it.tip} className="flex h-full items-end px-0.5 hover:bg-muted/50">
                <div
                  className="w-full rounded-t-[4px]"
                  style={{
                    height: `${(it.value / top) * 100}%`,
                    background: color,
                    minHeight: it.value ? 3 : 0,
                  }}
                />
              </Tip>
            </li>
          ))}
        </ul>
      </div>
      <span />
      <div className="flex gap-1 pt-1" aria-hidden>
        {items.map((it) => (
          <span
            key={it.key}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground tabular-nums"
          >
            {it.label}
          </span>
        ))}
      </div>
    </div>
  );
}
