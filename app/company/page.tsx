import type { Metadata } from "next";
import { CompanyIntake } from "@/components/company-intake";
import { IntakeTimeline } from "@/components/intake-timeline";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Company intake" };

export default function CompanyPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Companies · weeks before the event"
        title="Find suitable candidates"
        description="Tell TrueFit Assistant who you need in your own words. It works out the skills, and the people at this event whose skills fit appear here with their profile and contact details."
      />
      <PageGuide
        id="company"
        steps={[
          {
            title: "Describe who you need",
            text: "Open the chat in the bottom-right corner. “We need a developer” is a fine start.",
          },
          {
            title: "See who fits",
            text: "Suitable candidates appear as you chat, best skill match first, with their contact details.",
          },
          {
            title: "Invite them",
            text: "Invite people on the Candidates page, with a reason. They answer yes or no in their Meetings view.",
          },
        ]}
      />
      <CompanyIntake />
      <IntakeTimeline />
    </div>
  );
}
