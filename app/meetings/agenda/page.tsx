import type { Metadata } from "next";
import Link from "next/link";
import { Building2Icon, UserRoundIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { participants } from "@/lib/participants";

export const metadata: Metadata = { title: "Agendas" };

/** Demo index of every participant's agenda. In production each person sees only their own. */
export default function AgendasPage() {
  const all = participants();
  const groups = [
    { title: "Companies", icon: Building2Icon, items: all.filter((p) => p.kind === "company") },
    { title: "Candidates", icon: UserRoundIcon, items: all.filter((p) => p.kind === "talent") },
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Event day · per participant"
        title="Agendas"
        description="For the demo you can open anyone's agenda. In production each company and candidate signs in and sees only their own. All of these pages are prerendered."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {groups.map((g) => (
          <section key={g.title} className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <g.icon className="size-4 text-muted-foreground" /> {g.title}
            </h2>
            <ul className="divide-y rounded-xl border bg-card">
              {g.items.map((p) => (
                <li key={p.id}>
                  <Link href={`/meetings/agenda/${p.id}`} className="block px-4 py-2.5 hover:bg-muted/50">
                    <span className="block text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.sub}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
