import type { Metadata } from "next";
import Link from "next/link";
import { Meetings } from "@/components/meetings";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Meetings" };

export default function MeetingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        step={4}
        eyebrow="Both sides · before, during and after"
        title="Opt in, meet for 10 minutes, follow up"
        description="For the demo you play both sides. In production, each side sees only its own view on its own device."
      />
      <p className="text-sm">
        <Link href="/meetings/agenda" className="font-medium text-primary underline-offset-4 hover:underline">
          Open the agenda for any participant →
        </Link>
      </p>
      <Meetings />
    </div>
  );
}
