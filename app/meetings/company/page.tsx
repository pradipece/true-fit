import type { Metadata } from "next";
import { Suspense } from "react";
import { Meetings } from "@/components/meetings";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Candidates · Company view" };

export default function CompanyMeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Companies · your table"
        title="Candidates from Espoo"
        description="Espoo interviews candidates first and sends you their profile only when they pass. Decide whether to interview each one, book a time, give feedback and make a job offer."
      />
      <PageGuide
        id="meetings-company"
        steps={[
          {
            title: "Espoo interviews first",
            text: "Ask for anyone on Find candidates. Espoo assesses and interviews them, and sends you the profile if they pass.",
          },
          {
            title: "Invite to an interview",
            text: "You and the candidate each say yes. Asking Espoo earlier counts as your yes; a no is never explained.",
          },
          {
            title: "Interview and offer",
            text: "Book a 10-minute slot at your table, give feedback, then offer the job or not.",
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
