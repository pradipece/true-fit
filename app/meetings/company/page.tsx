import type { Metadata } from "next";
import { Suspense } from "react";
import { MeetingsSideNav } from "@/components/meetings-side-nav";
import { Meetings } from "@/components/meetings";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Meetings · Company view" };

export default function CompanyMeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <MeetingsSideNav />
      <PageHeader
        step={4}
        eyebrow="Companies · your table"
        title="Company view"
        description="Candidates the organiser approved for your needs. You see their evidence and why they were suggested; their name stays hidden until you both say yes."
      />
      {/* Selected pair lives in ?pair=, read on the client. */}
      <Suspense>
        <Meetings side="company" />
      </Suspense>
    </div>
  );
}
