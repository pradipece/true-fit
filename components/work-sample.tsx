"use client";

import { useRef, useState } from "react";
import { FileTextIcon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Work-sample upload: a small text file (script, query, plan, notes). It is read in the
 * browser and only a text excerpt is used for skill mapping; the file itself isn't stored.
 */

const ACCEPT = ".txt,.md,.csv,.json,.sql,.py,.js,.ts,.tsx,.html,.css,.yaml,.yml,.ino,.c,.cpp,.java,.r";
const MAX_BYTES = 200_000;
const EXCERPT = 3000;

export type Sample = { name: string; description: string; excerpt: string };

export const sampleToText = (s: Sample | null) =>
  s ? `${s.description.trim()}\n\nFrom ${s.name}:\n${s.excerpt}`.trim() : "";

export function WorkSample({
  value,
  onChange,
}: {
  value: Sample | null;
  onChange: (s: Sample | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 200 KB. Pick a smaller excerpt.");
    const text = await file.text().catch(() => "");
    if (!text.trim() || /[\u0000-\u0008]/.test(text.slice(0, 2000)))
      return setError("Only text files work here: code, queries, notes, CSV.");
    onChange({ name: file.name, description: value?.description ?? "", excerpt: text.slice(0, EXCERPT) });
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm">
            <FileTextIcon className="size-4 text-primary" />
            <span className="truncate font-medium">{value.name}</span>
            <span className="text-xs text-muted-foreground">
              {value.excerpt.length >= EXCERPT
                ? `first ${EXCERPT} characters`
                : `${value.excerpt.length} characters`}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              className="ml-auto"
              onClick={() => onChange(null)}
              aria-label="Remove file"
            >
              <XIcon />
            </Button>
          </div>
          <pre className="max-h-28 overflow-auto rounded bg-background p-2 font-mono text-[11px] leading-snug whitespace-pre-wrap text-muted-foreground">
            {value.excerpt.slice(0, 600)}
            {value.excerpt.length > 600 && "…"}
          </pre>
          <Input
            value={value.description}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
            placeholder="One line: what is it, and what was your part?"
            aria-label="Describe the work sample"
          />
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
          <UploadIcon data-icon="inline-start" /> Upload a text file
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Read in your browser. Only the text is sent for skill mapping; the file isn&apos;t stored. Remove
        names and company details first.
      </p>
    </div>
  );
}
