import type { Metadata } from "next";
import { MyAgenda } from "@/components/my-agenda";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "My agenda · Company view" };

export default function CompanyAgendaPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Companies · event day"
        title="My agenda"
        description="Your own meetings for the event day, plus anything still waiting for an answer. You can add them to your calendar."
      />
      <MyAgenda side="company" />
    </div>
  );
}
