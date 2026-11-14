import type { Metadata } from "next";
import { Suspense } from "react";
import { Meetings } from "@/components/meetings";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Meetings · Candidate view" };

export default function TalentMeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Candidates · your skill card"
        title="Candidate view"
        description="Companies the event organiser introduced you to. You see their need card and why your skills fit; say yes or no to each."
      />
      <PageGuide
        id="meetings-talent"
        steps={[
          {
            title: "See who wants to meet",
            text: "The organiser matched your skill card to these companies' needs and introduced you.",
          },
          {
            title: "Say yes or no",
            text: "You decide, and so does the company. A no is never explained to the other side.",
          },
          { title: "Meet and give feedback", text: "Book a 10-minute slot, then tell us how it went." },
        ]}
      />
      {/* Selected pair lives in ?pair=, read on the client. */}
      <Suspense>
        <Meetings side="talent" />
      </Suspense>
    </div>
  );
}
