import type { Metadata } from "next";
import { Suspense } from "react";
import { Meetings } from "@/components/meetings";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Introductions · Company view" };

export default function CompanyMeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Companies · your table"
        title="Introductions"
        description="Candidates the event organiser introduced to you. Say yes or no to each, book a slot once you both say yes, and give feedback after the meeting."
      />
      <PageGuide
        id="meetings-company"
        steps={[
          {
            title: "See who you were introduced to",
            text: "The organiser introduces people whose skills fit. Ask for anyone on Find candidates.",
          },
          {
            title: "Say yes or no",
            text: "You and the candidate each answer. Asking for an introduction counts as your yes; a no is never explained.",
          },
          {
            title: "Meet and give feedback",
            text: "Book a 10-minute slot at your table, then tell us how it went.",
          },
        ]}
      />
      {/* Selected pair lives in ?pair=, read on the client. */}
      <Suspense>
        <Meetings side="company" />
      </Suspense>
    </div>
  );
}
