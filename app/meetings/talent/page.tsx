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
        title="Your applications"
        description="Every role you asked about or Espoo invited you to, step by step: Espoo interview, company interview and job offer."
      />
      <PageGuide
        id="meetings-talent"
        steps={[
          {
            title: "Espoo interview",
            text: "Espoo reviews your skill card and invites you to a short interview. Accept and book a time.",
          },
          {
            title: "Company interview",
            text: "If you pass, Espoo sends your profile to the company. If it wants to meet, you say yes or no.",
          },
          {
            title: "Job offer",
            text: "After the interview, give feedback. If the company offers the job, you answer here.",
          },
        ]}
      />
      {/* Selected pair lives in ?pair=, read on the client. */}
      <Suspense>
        <Meetings side="talent" />
      </Suspense>
    </div>
  );
}
