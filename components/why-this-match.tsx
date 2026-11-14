"use client";

import { useState } from "react";
import { Loader2Icon, MessageCircleQuestionIcon, SparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { explainMatch } from "@/lib/match";
import { explainInput, rulesWhy, type WhyText } from "@/lib/match-explain";
import type { Need, Talent } from "@/lib/types";

/**
 * Plain-language "why this match", written by the LLM from the rule-based scoring output.
 * Only skills and evidence are sent; the text never changes the score or makes a decision.
 */

const cache = new Map<string, WhyText>();

export function WhyThisMatch({ need, talent }: { need: Need; talent: Talent }) {
  const m = explainMatch(need, talent);
  const key = `${need.id}:${talent.id}:${m.points}:${m.maxPoints}`;
  const [text, setText] = useState<WhyText | null>(() => cache.get(key) ?? null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let result: WhyText;
    try {
      const res = await fetch("/api/match/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Deliberately minimal: no name, headline, languages or audit attributes leave the browser.
        body: JSON.stringify({
          need: { id: need.id, title: need.title, must: need.must, nice: need.nice },
          talent: { id: talent.id, skills: talent.skills, evidence: talent.evidence },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      result = (await res.json()) as WhyText;
    } catch {
      result = { ...rulesWhy(explainInput(need.title, m)), source: "rules" };
    }
    cache.set(key, result);
    setText(result);
    setLoading(false);
  };

  if (!text)
    return (
      <Button size="xs" variant="secondary" onClick={load} disabled={loading}>
        {loading ? (
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
        ) : (
          <SparklesIcon data-icon="inline-start" />
        )}
        Why this match?
      </Button>
    );

  return (
    <div className="space-y-1.5 rounded-lg border border-primary/20 bg-accent/40 p-3 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <SparklesIcon className="size-3.5 text-primary" /> Why this match
        <Badge variant="outline" className="font-normal">
          {text.source === "ai" ? "Gemini, from the score" : "Template, from the score"}
        </Badge>
      </p>
      <p className="leading-relaxed">{text.why}</p>
      {text.ask && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageCircleQuestionIcon className="mt-0.5 size-3.5 shrink-0" /> {text.ask}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">Explains the rule-based score only. You decide.</p>
    </div>
  );
}
