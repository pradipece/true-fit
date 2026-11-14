import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchExplanationView, ScoreMeter } from "@/components/match-explanation";
import { SUGGEST_THRESHOLD } from "@/lib/match";
import type { MatchExplanation, Talent } from "@/lib/types";
import { cn } from "@/lib/utils";

export const displayName = (t: Talent) => t.contact?.fullName ?? t.revealName;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * One suitable candidate: name, synthetic contact details, skill match with the
 * person's own answers as proof, and practical context. Only skills feed the score.
 */
export function CandidateProfile({
  t,
  m,
  footer,
  note,
  role,
  otherRoles,
  company,
}: {
  t: Talent;
  m: MatchExplanation;
  /** The job title `m` is for, shown with the percentage. */
  role?: string;
  /** The same person's match for the company's other roles. */
  otherRoles?: { id: string; title: string; score: number; suggested: boolean }[];
  /**
   * The person's match with the company as a whole (its best role for them) and where the
   * company ranks among every company at the event for this person's skills.
   */
  company?: { name: string; score: number; rank: number; total: number };
  footer?: React.ReactNode;
  /** Shown above the details, e.g. the optional AI fit rate. */
  note?: React.ReactNode;
}) {
  const name = displayName(t);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Avatar>
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          {name}
          {t.createdByUser && <Badge>You</Badge>}
        </CardTitle>
        <CardDescription className="pl-10">{t.headline}</CardDescription>
        {!role && (
          <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
            <ScoreMeter score={m.score} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {role && <MatchPanel score={m.score} role={role} company={company} companyLabel="your company" />}
        {note}
        {otherRoles && otherRoles.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Match for your other roles">
            {otherRoles.map((r) => (
              <li key={r.id}>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-normal",
                    r.suggested
                      ? "border-evidence/30 bg-evidence-soft text-evidence"
                      : "text-muted-foreground",
                  )}
                >
                  {r.title} · <span className="tabular-nums">{Math.round(r.score * 100)}%</span>
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {t.contact && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label={`Contact details for ${name}`}>
            <li className="flex items-center gap-1.5 text-muted-foreground">
              <MapPinIcon className="size-3.5" /> {t.contact.city}
            </li>
            <li>
              <a
                href={`mailto:${t.contact.email}`}
                className="flex items-center gap-1.5 underline-offset-4 hover:underline"
              >
                <MailIcon className="size-3.5 text-muted-foreground" /> {t.contact.email}
              </a>
            </li>
            <li>
              <a
                href={`tel:${t.contact.phone.replace(/\s+/g, "")}`}
                className="flex items-center gap-1.5 tabular-nums underline-offset-4 hover:underline"
              >
                <PhoneIcon className="size-3.5 text-muted-foreground" /> {t.contact.phone}
              </a>
            </li>
          </ul>
        )}
        <MatchExplanationView m={m} />
        <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          <div>
            <dt className="inline text-muted-foreground">Background: </dt>
            <dd className="inline">{t.previousField}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Languages: </dt>
            <dd className="inline">
              {t.languages.map((l) => `${l.lang} (${l.level.toLowerCase()})`).join(", ")}
            </dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Prefers: </dt>
            <dd className="inline">{t.mode}</dd>
          </div>
          <div>
            <dt className="inline text-muted-foreground">Available: </dt>
            <dd className="inline">{t.availability}</dd>
          </div>
        </dl>
      </CardContent>
      {footer && <CardFooter className="flex-wrap gap-2">{footer}</CardFooter>}
    </Card>
  );
}

export type CompanyScore = { id: string; name: string; score: number; strong: number };

/**
 * The match for one job title, the match with the company behind it (its best role for this
 * person) and that company's rank among every company at the event. With `companies`, it
 * also lists each company's match for the person, best first. Skills only, like every match.
 */
export function MatchPanel({
  score,
  role,
  company,
  companyLabel = "the company",
  companies,
  currentId,
}: {
  score: number;
  role: string;
  company?: { name: string; score: number; rank: number; total: number };
  /** How the company is referred to: "your company" for the company itself. */
  companyLabel?: string;
  /** Every company ranked for this person (`companiesFor`). */
  companies?: CompanyScore[];
  /** The company `role` belongs to, highlighted in `companies`. */
  currentId?: string;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Match for the job title</p>
          <ScoreMeter score={score} role={role} />
        </div>
        {company && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Match with {companyLabel}</p>
            <ScoreMeter score={company.score} role={company.name} />
            <p className="text-xs text-muted-foreground tabular-nums">
              {company.rank === 1 ? (
                <span className="font-medium text-evidence">Best-matching company for them</span>
              ) : (
                <>
                  Company #{company.rank} of {company.total} for their skills
                </>
              )}
            </p>
          </div>
        )}
      </div>
      {companies && companies.length > 0 && (
        <div className="space-y-1.5 border-t pt-2.5">
          <p className="text-xs text-muted-foreground">Company match for this person, best first</p>
          <ol className="flex flex-wrap gap-1.5">
            {companies.map((c, i) => (
              <li key={c.id}>
                <Badge
                  variant="outline"
                  title={`${c.strong} strong ${c.strong === 1 ? "fit" : "fits"}`}
                  className={cn(
                    "font-normal tabular-nums",
                    c.score >= SUGGEST_THRESHOLD
                      ? "border-evidence/30 bg-evidence-soft text-evidence"
                      : "text-muted-foreground",
                    c.id === currentId && "ring-2 ring-primary/40",
                  )}
                >
                  {i + 1}. {c.name} · {Math.round(c.score * 100)}%
                </Badge>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
