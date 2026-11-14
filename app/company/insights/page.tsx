import type { Metadata } from "next";
import { EventInsights } from "@/components/event-insights";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Insights · Company view" };

export default function CompanyInsightsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Companies · at a glance"
        title="Event insights"
        description="How the event is going, in numbers: who has registered, how matches are moving, how full the schedule is and what people said afterwards. Only totals and averages, never individuals. Hover a bar for details, or switch any chart to a table."
      />
      <EventInsights />
    </div>
  );
}
