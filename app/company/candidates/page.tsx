import type { Metadata } from "next";
import { CandidateReview } from "@/components/candidate-review";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Candidates · Company view" };

export default function CompanyCandidatesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Companies · before the event"
        title="Suitable candidates"
        description="People at this event whose skills fit your approved need cards, best skill match first, with their own answers as proof and their contact details. You decide whom to invite; every decision is logged with a reason."
      />
      <PageGuide
        id="company-candidates"
        steps={[
          {
            title: "Pick a need",
            text: "Each approved need card lists the people whose skills fit it.",
          },
          {
            title: "Look at the proof",
            text: "See which skills match, why, and the person's own answers. Nobody is hidden for scoring low.",
          },
          {
            title: "Invite or pass, with a reason",
            text: "Invited candidates answer in their Meetings view. Every decision can be changed and is logged.",
          },
        ]}
      />
      <CandidateReview />
    </div>
  );
}
