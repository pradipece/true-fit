import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchExplanationView, ScoreMeter } from "@/components/match-explanation";
import type { MatchExplanation, Talent } from "@/lib/types";

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
}: {
  t: Talent;
  m: MatchExplanation;
  footer?: React.ReactNode;
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
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <ScoreMeter score={m.score} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
