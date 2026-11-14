import type { Metadata } from "next";
import { OrganiserReview } from "@/components/organiser-review";
import { PageGuide } from "@/components/page-guide";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Introductions · Organiser view" };

export default function OrganiserPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Organiser · before the event"
        title="Introductions"
        description="As the event's broker, you see every company's needs and the people whose skills fit them, best skill match first, with their own answers as proof. You decide whom to introduce to whom; the company and the candidate then each say yes or no. Every decision is logged with a reason."
      />
      <PageGuide
        id="organiser-introductions"
        steps={[
          {
            title: "Pick a need",
            text: "Each company's role lists the people whose skills fit it. Requests from either side are flagged.",
          },
          {
            title: "Look at the proof",
            text: "See which skills match, why, and the person's own answers. Nobody is hidden for scoring low.",
          },
          {
            title: "Introduce or pass, with a reason",
            text: "Both sides answer yes or no in their own view. Follow every introduction in All introductions.",
          },
        ]}
      />
      <OrganiserReview />
    </div>
  );
}
