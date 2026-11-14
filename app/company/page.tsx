import type { Metadata } from "next";
import { CompanyIntake } from "@/components/company-intake";
import { IntakeTimeline } from "@/components/intake-timeline";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Company intake" };

export default function CompanyPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        step={1}
        eyebrow="Companies · weeks before the event"
        title="From “we need a dev” to a concrete need card"
        description="A short guided chat asks the clarifying questions, maps your answers to ESCO skills and nudges you away from requirements that shrink the pool for no reason. You edit and approve the card before anything is sent."
      />
      <IntakeTimeline />
      <CompanyIntake />
    </div>
  );
}
