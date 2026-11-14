import type { Metadata } from "next";
import { ExploreRoles } from "@/components/explore-roles";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Explore roles · Job seeker view" };

export default function ExploreRolesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Job seekers · before the event"
        title="Explore roles. Don't just wait to be found."
        description="Every role at this event, ranked by the same skill match companies see. Find out what would make your card stronger, and ask to meet the companies you like. The event organiser makes the introductions."
      />
      <PageGuide
        id="talent-explore"
        steps={[
          {
            title: "See where you fit",
            text: "Every role is ranked by your skills only. Nothing about where you come from counts.",
          },
          {
            title: "Make your card stronger",
            text: "See which example would raise your match most, and which skill would open the most roles.",
          },
          {
            title: "Ask to meet",
            text: "The organiser sees your request next to your skill card. If it introduces you and the company says yes, pick a time in Meetings.",
          },
        ]}
      />
      <ExploreRoles />
    </div>
  );
}
