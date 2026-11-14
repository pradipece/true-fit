import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Agenda } from "@/components/agenda";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { participantById, participants } from "@/lib/participants";

/** Every participant's agenda is prerendered at build time, so event-day traffic hits static files. */
export function generateStaticParams() {
  return participants().map((p) => ({ participant: p.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/meetings/agenda/[participant]">): Promise<Metadata> {
  const p = participantById((await params).participant);
  return { title: p ? `Agenda · ${p.name}` : "Agenda" };
}

export default async function AgendaPage({ params }: PageProps<"/meetings/agenda/[participant]">) {
  const p = participantById((await params).participant);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <Button
        size="sm"
        variant="ghost"
        nativeButton={false}
        render={<Link href="/meetings/agenda" />}
        className="print:hidden"
      >
        <ArrowLeftIcon data-icon="inline-start" /> All agendas
      </Button>
      <PageHeader
        eyebrow={p.kind === "company" ? `Company agenda · ${p.sub}` : "Candidate agenda"}
        title={p.name}
        description="Your meetings for the event day, plus anything still waiting for an answer. You can add it to your calendar."
      />
      <Agenda who={{ kind: p.kind, id: p.id }} name={p.name} />
    </div>
  );
}
