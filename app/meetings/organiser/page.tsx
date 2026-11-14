import type { Metadata } from "next";
import { OrganiserMeetings } from "@/components/organiser-meetings";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Meetings · Organiser view" };

export default function OrganiserMeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="City of Espoo organisers · event day"
        title="Organiser view"
        description="Every approved pair at a glance: who still has to answer, which meetings are booked at each table, and how they went. Only the two sides can opt in or book; you can send reminders."
      />
      <PageGuide
        id="organiser-event-day"
        steps={[
          {
            title: "Check who still has to answer",
            text: "Pairs waiting on a yes or no are listed with who is missing.",
          },
          { title: "Send a reminder", text: "Nudge people who haven't answered. You can't answer for them." },
          { title: "Follow the day", text: "The schedule shows every booked meeting per table and time." },
        ]}
      />
      <OrganiserMeetings />
    </div>
  );
}
