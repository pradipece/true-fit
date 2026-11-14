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
        title="From “we need a dev” to a concrete need card"
        description="A short guided chat asks the clarifying questions, turns your answers into a list of skills and warns you about requirements that rule people out for no good reason. You edit and approve the card before anything is sent."
      />
      <PageGuide
        id="company"
        steps={[
          {
            title: "Describe who you need",
            text: "Tell the assistant in your own words. “We need a developer” is a fine start.",
          },
          {
            title: "Check the card",
            text: "The need card on the right fills in as you chat. Change anything. Keep must-haves to three or fewer.",
          },
          {
            title: "Approve it",
            text: "Nothing is shared until you approve. The organiser then suggests people who fit.",
          },
        ]}
      />
      <CompanyIntake />
      <IntakeTimeline />
    </div>
  );
}
