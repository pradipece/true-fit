"use client";

import { useRef, useState } from "react";
import {
  CheckIcon,
  ClipboardPasteIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  FileUpIcon,
  Loader2Icon,
  QuoteIcon,
  ScanSearchIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SkillChip } from "@/components/skill-chip";
import type { CvLanguage, CvScan } from "@/lib/cv-import";
import type { PrivacyFlag } from "@/lib/talent-ai";
import { cn } from "@/lib/utils";

/**
 * "Start from your CV": upload a LinkedIn "Save to PDF" export or any ATS-style CV (PDF or
 * Word .docx), or paste the text. The server scans it; the person reviews what was found and chooses
 * what to carry over. Nothing is applied without their click, and the CV isn't kept.
 */

export type CvApply = { title: string; path: string; skills: string[]; languages: CvLanguage[] };

const ACCEPT =
  ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const MAX_BYTES = 5_000_000;

const KIND_LABEL: Record<PrivacyFlag["kind"], string> = {
  name: "Name",
  contact: "Contact",
  age: "Age",
  nationality: "Origin",
  school: "School",
  family: "Family or health",
  other: "Identifying",
};

/** Synthetic LinkedIn-style export for the demo. Fictional person, fictional employers. */
const DEMO_PROFILE = `Contact
www.linkedin.com/in/demo-candidate (LinkedIn)
demo.candidate@example.com

Top Skills
SQL
Inventory management
Team leadership

Languages
English (Full Professional)
Spanish (Native or Bilingual)
Finnish (Elementary)

Alex Demo
Logistics coordinator moving into data analysis
Espoo, Uusimaa, Finland

Summary
Eight years keeping warehouses running: stock control, shift planning and supplier contact. I taught myself SQL to fix our weekly reporting and now build small dashboards for the operations team.

Experience
Northwind Logistics
Logistics Coordinator
March 2019 - Present (5 years 9 months)
Planned shifts for a team of twelve and handled supplier claims.
Wrote SQL queries and a spreadsheet dashboard to track late deliveries per carrier.
Led the move to a new warehouse management system and trained colleagues on it.

Contoso Retail
Warehouse Team Lead
January 2015 - February 2019 (4 years 2 months)
Managed inventory counts and reduced picking errors by reorganising the storage layout.
Resolved customer complaints about late orders together with the drivers.

Education
Universidad de Ejemplo
Bachelor of Business Administration, 2010 - 2014`;

/** Synthetic ATS-style CV (single column, standard headings) for the demo. Fictional person. */
const DEMO_CV = `SAMIRA EXAMPLE
Espoo, Finland | samira.example@example.com | +358 40 000 0000

PROFESSIONAL SUMMARY
Practical nurse with six years in elderly care and home care. Calm under pressure, good at explaining care plans to families, and recently trained in electronic patient records.

CORE COMPETENCIES
Patient care | Medication administration | Electronic health records | Teamwork | Customer service

PROFESSIONAL EXPERIENCE
Practical Nurse | Example Home Care Oy | 04/2021 – Present
- Visit 8–10 elderly clients a day: medication, wound care and daily routines.
- Introduced a shared checklist that cut missed medication doses on our route.
- Train new colleagues on the electronic patient record system.

Care Assistant, Sunny Days Care Home | 2018 – 2021
- Supported residents with dementia and kept relatives informed about changes.

EDUCATION
Vocational Qualification in Social and Health Care, Example Vocational College, 2018

LANGUAGES
English – fluent; Finnish – B1; Arabic – native
`;

export function CvImport({ onApply }: { onApply: (v: CvApply) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<CvScan | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);

  const run = async (body: BodyInit, headers?: HeadersInit) => {
    setScanning(true);
    setError(null);
    setScan(null);
    setApplied(false);
    try {
      const res = await fetch("/api/talent/cv", { method: "POST", body, headers });
      const data = (await res.json().catch(() => ({}))) as CvScan & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `Scan failed (${res.status})`);
      setScan(data);
      setSkip(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed. Try again.");
    }
    setScanning(false);
  };

  const scanFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("That file is over 5 MB.");
    setFileName(file.name);
    const form = new FormData();
    form.append("file", file);
    run(form);
  };

  const scanText = (value = text) => {
    if (value.trim().length < 40) return setError("Paste a bit more of your profile first.");
    setFileName(null);
    run(JSON.stringify({ text: value }), { "Content-Type": "application/json" });
  };

  const apply = () => {
    if (!scan) return;
    onApply({
      title: scan.title,
      path: scan.path,
      skills: scan.skills.filter((s) => !skip.has(s.skill)).map((s) => s.skill),
      languages: scan.languages,
    });
    setApplied(true);
  };

  const toggle = (id: string) =>
    setSkip((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed p-4 text-left transition-colors hover:bg-muted/50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <ScanSearchIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Start from your CV or LinkedIn profile</span>
          <span className="block text-xs text-muted-foreground">
            Upload a PDF or Word CV, or your LinkedIn profile. AI fills in your background and suggests
            skills. You check everything first.
          </span>
        </span>
        <FileUpIcon className="size-4 text-muted-foreground" />
      </button>
    );

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScanSearchIcon className="size-4 text-primary" />
          <h3 className="font-medium">Import your CV</h3>
          {scan && (
            <Badge variant="outline" className="font-normal">
              {scan.source === "ai" ? "AI" : "Basic mode"}
            </Badge>
          )}
        </div>
        <Button size="icon-sm" variant="ghost" onClick={() => setOpen(false)} aria-label="Close CV import">
          <XIcon />
        </Button>
      </div>

      <ol className="space-y-1 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">From LinkedIn:</span> open your profile, choose{" "}
          <span className="font-medium text-foreground">Resources → Save to PDF</span>, then upload the file
          here.{" "}
          <a
            href="https://www.linkedin.com/in/me/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Open my LinkedIn profile <ExternalLinkIcon className="size-3" />
          </a>
        </li>
        <li>
          <span className="font-medium text-foreground">Your own CV:</span> the PDF or Word (.docx) file you
          send with job applications. Standard CV layouts work best; scanned images can&apos;t be read.
        </li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => input.current?.click()} disabled={scanning}>
          {scanning && fileName ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <FileUpIcon data-icon="inline-start" />
          )}
          Upload CV
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPasting((p) => !p)} disabled={scanning}>
          <ClipboardPasteIcon data-icon="inline-start" /> Paste text
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPasting(true);
            setText(DEMO_PROFILE);
            scanText(DEMO_PROFILE);
          }}
          disabled={scanning}
        >
          <SparklesIcon data-icon="inline-start" /> Demo LinkedIn profile
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setPasting(true);
            setText(DEMO_CV);
            scanText(DEMO_CV);
          }}
          disabled={scanning}
        >
          <SparklesIcon data-icon="inline-start" /> Demo CV
        </Button>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            scanFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {pasting && (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Paste your CV or LinkedIn profile text here…"
            aria-label="CV text"
          />
          <Button size="sm" variant="secondary" onClick={() => scanText()} disabled={scanning}>
            {scanning && !fileName ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : (
              <ScanSearchIcon data-icon="inline-start" />
            )}
            Scan text
          </Button>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <EyeOffIcon className="mt-0.5 size-3.5 shrink-0" />
        Your CV is read once and not saved. Contact details are removed before the AI reads it, and your name,
        schools and employers never go on your card.
      </p>

      {scanning && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" /> Scanning {fileName ?? "your profile"}…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {scan && !scanning && (
        <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
          <p className="text-sm font-medium">
            {scan.linkedin ? "Found in your LinkedIn profile" : "Found in your CV"}
          </p>
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">Latest job title</dt>
              <dd>{scan.title || <span className="text-muted-foreground italic">Not found</span>}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">Your path, without names or places</dt>
              <dd>{scan.path || <span className="text-muted-foreground italic">Not found</span>}</dd>
            </div>
            {scan.languages.length > 0 && (
              <div className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">Working languages</dt>
                <dd>{scan.languages.join(", ")}</dd>
              </div>
            )}
          </dl>

          {scan.skills.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Skills your CV mentions. Untick any that aren&apos;t right. They count as{" "}
                <span className="font-medium text-foreground">stated</span>: your answers in step 3 can show
                them.
              </p>
              <ul className="space-y-1.5">
                {scan.skills.map((s) => {
                  const on = !skip.has(s.skill);
                  return (
                    <li key={s.skill} className={cn("flex items-start gap-2 text-xs", !on && "opacity-50")}>
                      <button
                        type="button"
                        onClick={() => toggle(s.skill)}
                        aria-pressed={on}
                        className="shrink-0"
                      >
                        <SkillChip id={s.skill} kind={on ? "claimed" : "neutral"} />
                      </button>
                      <span className="flex min-w-0 gap-1 pt-1 text-muted-foreground">
                        <QuoteIcon className="mt-0.5 size-3 shrink-0" />
                        <span className="italic">“{s.quote}”</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No skills from the EU skills list found. You can pick them in the next step.
            </p>
          )}

          {scan.removed.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Left out of your card</p>
              <ul className="flex flex-wrap gap-1.5">
                {scan.removed.slice(0, 12).map((r) => (
                  <li key={`${r.kind}:${r.text}`}>
                    <Badge variant="outline" className="max-w-64 bg-card font-normal">
                      <span className="text-muted-foreground">{KIND_LABEL[r.kind]}:</span>
                      <span className="truncate line-through">{r.text}</span>
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button size="sm" onClick={apply} disabled={applied}>
            {applied ? <CheckIcon data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
            {applied ? "Added to your card" : "Use this"}
          </Button>
        </div>
      )}
    </div>
  );
}
