"use client";

import { QuoteIcon } from "lucide-react";
import { useSession } from "@/components/session";
import { SkillChip, SkillLegend } from "@/components/skill-chip";
import { TalentProfile } from "@/components/talent-profile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SEED_TALENT } from "@/lib/seed";
import { useDemo } from "@/lib/store";
import type { Talent } from "@/lib/types";

/**
 * My profile: a job seeker with their own account builds and edits their profile; a demo
 * candidate (synthetic seed persona) sees their profile view-only, so a crowd trying the
 * demo never changes the profiles everyone else sees. The server enforces the same rule.
 */
export function MyProfile() {
  const { session } = useSession();
  const { talent } = useDemo();
  const id = session?.role === "talent" ? session.id : undefined;
  const seed = id ? SEED_TALENT.find((t) => t.id === id) : undefined;
  if (!seed) return <TalentProfile />;
  return <DemoProfileView t={talent.find((t) => t.id === seed.id) ?? seed} />;
}

function DemoProfileView({ t }: { t: Talent }) {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardDescription>{t.previousField}</CardDescription>
          <CardTitle className="text-xl">{t.contact?.fullName ?? t.revealName}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.headline}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {t.skills.map((s) => (
                <SkillChip key={s.id} id={s.id} kind={s.level} />
              ))}
            </div>
            <SkillLegend />
          </section>
          {t.evidence.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">In their own words</h3>
              <ul className="space-y-2">
                {t.evidence.map((e) => (
                  <li key={e.prompt} className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p className="mb-1 text-xs text-muted-foreground">{e.prompt}</p>
                    <p className="flex gap-2">
                      <QuoteIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      {e.excerpt}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Languages: {t.languages.map((l) => `${l.lang} (${l.level.toLowerCase()})`).join(", ")}
            </span>
            <span>Way of working: {t.mode}</span>
            <span>Available: {t.availability}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
