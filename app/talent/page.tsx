import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { TalentProfile } from "@/components/talent-profile";

export const metadata: Metadata = { title: "Talent skill card" };

export default function TalentPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        step={2}
        eyebrow="Talent · before the event"
        title="Show what you can do. No CV needed."
        description="Translate your past job or unusual path into local skills, answer four short real-life questions, and see which answer supports which skill. You edit everything; companies first see an anonymised skill card."
      />
      <TalentProfile />
    </div>
  );
}
