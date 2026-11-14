import type { Metadata } from "next";
import { OrganiserDashboard } from "@/components/organiser-dashboard";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Organiser dashboard" };

export default function OrganiserPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="City of Espoo organisers · before the event"
        title="Review suggested matches"
        description="Suggestions are ranked by how well skills match, and you can see exactly why. Nothing is sent to anyone until you approve it, and every decision is logged."
      />
      <PageGuide
        id="organiser-matches"
        steps={[
          {
            title: "Start with the overview",
            text: "See what needs your attention and which needs are hard to fill.",
          },
          {
            title: "Open a suggestion",
            text: "Each one shows which skills match and the person's own answers as proof.",
          },
          {
            title: "Decide, with a reason",
            text: "Approve or reject. Nothing happens automatically, and every decision is logged.",
          },
        ]}
      />
      <OrganiserDashboard />
    </div>
  );
}
