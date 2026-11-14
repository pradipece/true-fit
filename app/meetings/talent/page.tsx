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
        description="Companies suggested to you by the organiser. You see the need and why you were suggested; your name stays hidden until you both say yes."
      />
      <PageGuide
        id="meetings-talent"
        steps={[
          {
            title: "See who wants to meet",
            text: "These companies were suggested to you and approved by the organiser.",
          },
          {
            title: "Say yes or no",
            text: "Your name stays hidden until you both say yes. A no is never explained to the company.",
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
