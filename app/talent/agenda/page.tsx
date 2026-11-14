import type { Metadata } from "next";
import { MyAgenda } from "@/components/my-agenda";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "My agenda · Job seeker view" };

export default function JobseekerAgendaPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Job seeker · My agenda"
        title="My interviews"
        description="Your Espoo and company interviews this week (Mon–Fri, office hours), plus anything still waiting for an answer. You can add them to your calendar."
      />
      <MyAgenda side="talent" />
    </div>
  );
}
