import type { Metadata } from "next";
import { ExploreRoles } from "@/components/explore-roles";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Find jobs · Job seeker" };

export default function ExploreRolesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Job seeker · Find jobs"
        title="Find your next job"
        description="Open jobs at Espoo companies, ranked by the same skill match the companies see. Apply in one click; the City of Espoo team interviews you first and introduces you. Interviews are on weekdays, in Espoo or online."
      />
      <PageGuide
        id="talent-explore"
        steps={[
          {
            title: "Search and compare",
            text: "Every job shows your skill match. Only skills count, never where you come from.",
          },
          {
            title: "Make your profile stronger",
            text: "See which example would raise your match most, and which skill would open the most jobs.",
          },
          {
            title: "Apply",
            text: "Espoo reviews your application and invites you to a short interview. Pick a weekday time that suits you in My applications.",
          },
        ]}
      />
      <ExploreRoles />
    </div>
  );
}
