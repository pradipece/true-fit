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
        description="Candidates you invited. Follow who has answered, book a slot once they say yes, and give feedback after the meeting."
      />
      <PageGuide
        id="meetings-company"
        steps={[
          {
            title: "See who you invited",
            text: "Invite people from the Candidates page; they show up here.",
          },
          {
            title: "Say yes or no",
            text: "Inviting counts as your yes. The candidate answers; a no is never explained.",
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
