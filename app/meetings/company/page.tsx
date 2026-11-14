import type { Metadata } from "next";
import { Suspense } from "react";
import { Meetings } from "@/components/meetings";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Meetings · Company view" };

export default function CompanyMeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Companies · your table"
        title="Company view"
        description="Candidates the organiser approved for your needs. You see their evidence and why they were suggested; their name stays hidden until you both say yes."
      />
      <PageGuide
        id="meetings-company"
        steps={[
          {
            title: "See who was suggested",
            text: "These candidates were approved by the organiser for your needs.",
          },
          {
            title: "Say yes or no",
            text: "Names are shown only when you both say yes. A no is never explained to the other side.",
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
