import type { Metadata } from "next";
import { OrganiserInsights } from "@/components/organiser-insights";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Organiser dashboard" };

export default function OrganiserDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="City of Espoo organisers · at a glance"
        title="Event dashboard"
        description="How the event is going, in numbers: who has registered, how matches are moving, how full the schedule is and what people said afterwards. Only totals and averages, never individuals. Hover a bar for details, or switch any chart to a table."
      />
      <OrganiserInsights />
    </div>
  );
}
