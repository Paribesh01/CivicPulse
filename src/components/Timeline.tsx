import type { EventType } from "@/generated/prisma";
import { formatRelative } from "@/lib/sla-status";

export type TimelineEvent = {
  id: string;
  type: EventType;
  message: string;
  createdAt: Date;
  actor: { name: string } | null;
};

/// Colour by consequence, not by category: the eye should find escalations
/// immediately when scanning a long trail.
const DOT_TONE: Partial<Record<EventType, string>> = {
  ESCALATED: "bg-critical",
  WARNING: "bg-warn",
  REMINDER: "bg-ink-faint",
  RESOLVED: "bg-good",
  REOPENED: "bg-warn",
  TRIAGE_FAILED: "bg-warn",
  COMMENT: "bg-ink-faint",
};

const TYPE_LABEL: Record<EventType, string> = {
  SUBMITTED: "Submitted",
  CLASSIFIED: "Classified",
  ROUTED: "Routed",
  PRIORITIZED: "Prioritised",
  LOCATED: "Located",
  ASSIGNED: "Assigned",
  REASSIGNED: "Reassigned",
  REMINDER: "Reminder",
  WARNING: "Warning",
  ESCALATED: "Escalated",
  STATUS_CHANGED: "Status changed",
  COMMENT: "Comment",
  RESOLVED: "Resolved",
  REOPENED: "Reopened",
  DUPLICATE_MERGED: "Merged as duplicate",
  TRIAGE_FAILED: "Needs manual triage",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-ink-soft">Nothing recorded yet.</p>;
  }

  return (
    <ol className="border-l-2 border-line pl-5">
      {events.map((event) => (
        <li key={event.id} className="relative pb-5 last:pb-0">
          <span
            className={`absolute -left-[1.585rem] top-1.5 h-2.5 w-2.5 rounded-full ${
              DOT_TONE[event.type] ?? "bg-accent"
            }`}
          />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-[0.7rem] uppercase tracking-wider text-accent-ink">
              {TYPE_LABEL[event.type]}
            </span>
            <span className="font-mono text-[0.68rem] text-ink-faint">
              {formatRelative(event.createdAt)}
            </span>
            {event.actor && (
              <span className="text-[0.7rem] text-ink-faint">
                by {event.actor.name}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
            {event.message}
          </p>
        </li>
      ))}
    </ol>
  );
}
