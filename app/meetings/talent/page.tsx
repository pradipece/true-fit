import type { Metadata } from "next";
import { Suspense } from "react";
import { MeetingsSideNav } from "@/components/meetings-side-nav";
import { Meetings } from "@/components/meetings";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Meetings · Candidate view" };

export default function TalentMeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <MeetingsSideNav />
      <PageHeader
        step={4}
        eyebrow="Candidates · your skill card"
        title="Candidate view"
        description="Companies suggested to you by the organiser. You see the need and why you were suggested; your name stays hidden until you both say yes."
      />
      {/* Selected pair lives in ?pair=, read on the client. */}
      <Suspense>
        <Meetings side="talent" />
      </Suspense>
    </div>
  );
}
