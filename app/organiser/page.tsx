import type { Metadata } from "next";
import { OrganiserDashboard } from "@/components/organiser-dashboard";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Organiser dashboard" };

export default function OrganiserPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        step={3}
        eyebrow="City of Espoo organisers · before the event"
        title="Review suggested matches"
        description="Suggestions are ranked by transparent skill overlap. Nothing is sent to anyone until you approve it, and every decision is logged."
      />
      <OrganiserDashboard />
    </div>
  );
}
