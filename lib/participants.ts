import { OWN_COMPANY, SEED_NEEDS, SEED_TALENT } from "./data";
import { rooms, type Participant } from "./schedule";

/**
 * Everyone who gets an agenda page. Known at build time, so every page is prerendered.
 * "C-YOU" and "T-YOU" are the company and skill card created during the demo.
 */
export type ParticipantEntry = Participant & { name: string; sub: string };

export function participants(): ParticipantEntry[] {
  const companies: ParticipantEntry[] = rooms(SEED_NEEDS).map((r) => ({
    kind: "company",
    id: r.companyId,
    name: r.company,
    sub: r.label,
  }));
  const own: ParticipantEntry[] = [
    {
      kind: "company",
      id: "C-YOU",
      name: OWN_COMPANY.name,
      sub: "Need card created in the company view",
    },
    { kind: "talent", id: "T-YOU", name: "New job seeker", sub: "Profile created in the job seeker view" },
  ];
  // The demo "signed in as" list: each candidate is shown to themselves, so by name.
  const candidates: ParticipantEntry[] = SEED_TALENT.map((t) => ({
    kind: "talent",
    id: t.id,
    name: t.contact?.fullName ?? t.revealName,
    sub: t.headline,
  }));
  return [...companies, ...candidates, ...own];
}

export const participantById = (id: string) => participants().find((p) => p.id === id);
