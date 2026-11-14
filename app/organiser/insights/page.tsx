import type { Metadata } from "next";
import { EventInsights } from "@/components/event-insights";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Insights · Organiser view" };

export default function OrganiserInsightsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Organiser · at a glance"
        title="Event insights"
        description="How the event is going, in numbers: who has registered, how introductions are moving, how full the schedule is and what people said afterwards. Only totals and averages, never individuals. Hover a bar for details, or switch any chart to a table."
      />
      <EventInsights />
    </div>
  );
}
