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
        description="Pick your skills, translate past job titles into local vocabulary, and back them up with three short answers. Companies first see an anonymised skill card."
      />
      <TalentProfile />
    </div>
  );
}
