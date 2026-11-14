import type { Metadata } from "next";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";
import { TalentProfile } from "@/components/talent-profile";

export const metadata: Metadata = { title: "Talent skill card" };

export default function TalentPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Talent · before the event"
        title="Show what you can do. No CV needed."
        description="Translate your past job or unusual path into local skills, answer four short real-life questions, and see which answer supports which skill. You edit everything; companies first see an anonymised skill card."
      />
      <PageGuide
        id="talent"
        steps={[
          {
            title: "Start with your job",
            text: "Type a job title or describe your background. We turn it into skills.",
          },
          {
            title: "Show what you can do",
            text: "Pick your skills and answer a few short questions. No CV needed.",
          },
          {
            title: "Check and join",
            text: "Your card is anonymous. Your name is only shared when you and a company both agree to meet.",
          },
        ]}
      />
      <TalentProfile />
    </div>
  );
}
