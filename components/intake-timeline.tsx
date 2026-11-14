import {
  BellIcon,
  CalendarCheckIcon,
  CheckIcon,
  HandshakeIcon,
  MailIcon,
  MessageSquareIcon,
  StarIcon,
  UserPlusIcon,
} from "lucide-react";
import { EVENT } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Mock reminder timeline: shows that intake happens weeks before the event, which gives
 * time to reach matching talent who haven't registered yet.
 */

const STEPS = [
  {
    week: -6,
    icon: MailIcon,
    title: "Invite + intake link",
    body: "Sent to companies registered for the event",
  },
  { week: -4, icon: BellIcon, title: "Reminder", body: "“5 minutes: tell us who you'd like to meet”" },
  {
    week: -3,
    icon: MessageSquareIcon,
    title: "Intake chat",
    body: "You describe who you need to TrueFit Assistant",
  },
  {
    week: -2,
    icon: UserPlusIcon,
    title: "Talent invited",
    body: "Reminder sent to matching people not yet registered",
  },
  {
    week: -1,
    icon: HandshakeIcon,
    title: "Review + opt-in",
    body: "You invite suitable candidates, they say yes or no",
  },
  { week: 0, icon: CalendarCheckIcon, title: "Event day", body: "10-minute meetings, on site or online" },
  { week: 1, icon: StarIcon, title: "Feedback", body: "Did the evidence hold up? Improves next time" },
];

const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function IntakeTimeline() {
  const event = new Date(`${EVENT.isoDate}T00:00:00Z`);
  const now = -EVENT.weeksAway;

  return (
    <section aria-label="Reminder timeline" className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Why we ask now</h2>
        <p className="text-xs text-muted-foreground">
          {EVENT.name} · {EVENT.date} · mock reminder schedule
        </p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {STEPS.map((s) => {
          const date = new Date(event.getTime() + s.week * 7 * 24 * 3600 * 1000);
          const state = s.week < now ? "done" : s.week === now ? "current" : "upcoming";
          const Icon = state === "done" ? CheckIcon : s.icon;
          return (
            <li
              key={s.week}
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "relative flex gap-2.5 rounded-lg p-2 lg:flex-col lg:gap-2",
                state === "current" && "bg-accent ring-1 ring-primary/30",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border",
                  state === "done" && "border-evidence/30 bg-evidence-soft text-evidence",
                  state === "current" && "border-primary bg-primary text-primary-foreground",
                  state === "upcoming" && "text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase tabular-nums">
                  {s.week === 0 ? "Event" : s.week < 0 ? `${-s.week} wk before` : `${s.week} wk after`} ·{" "}
                  {fmt.format(date)}
                </p>
                <p className={cn("text-sm font-medium", state === "upcoming" && "text-muted-foreground")}>
                  {s.title}
                  {state === "current" && (
                    <span className="ml-1.5 text-xs font-normal text-primary">you are here</span>
                  )}
                </p>
                <p className="text-xs leading-snug text-muted-foreground">{s.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
