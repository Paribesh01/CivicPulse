import type { ComplaintStatus, Priority } from "@/generated/prisma";
import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="eyebrow inline-flex items-center gap-2">
      <span className="h-[7px] w-[7px] rounded-full bg-accent" />
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface shadow-card ${className}`}
    >
      {children}
    </div>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  CRITICAL: "bg-critical-soft text-critical",
  HIGH: "bg-warn-soft text-warn",
  MEDIUM: "bg-accent-soft text-accent-ink",
  LOW: "bg-surface-2 text-ink-soft",
};

export function PriorityPill({
  priority,
  score,
}: {
  priority: Priority;
  score?: number | null;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[0.7rem] font-medium ${PRIORITY_STYLES[priority]}`}
    >
      {priority}
      {typeof score === "number" && <span className="tnum opacity-70">{score}</span>}
    </span>
  );
}

const STATUS_LABELS: Record<ComplaintStatus, string> = {
  SUBMITTED: "Submitted",
  TRIAGED: "Awaiting assignment",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  DUPLICATE: "Duplicate",
};

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  SUBMITTED: "bg-surface-2 text-ink-soft",
  TRIAGED: "bg-warn-soft text-warn",
  ASSIGNED: "bg-accent-soft text-accent-ink",
  IN_PROGRESS: "bg-accent-soft text-accent-ink",
  RESOLVED: "bg-good-soft text-good",
  CLOSED: "bg-surface-2 text-ink-soft",
  REJECTED: "bg-surface-2 text-ink-faint",
  DUPLICATE: "bg-surface-2 text-ink-faint",
};

export function StatusPill({ status }: { status: ComplaintStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 font-mono text-[0.7rem] font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function statusLabel(status: ComplaintStatus): string {
  return STATUS_LABELS[status];
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "critical" | "good";
}) {
  const toneClass =
    tone === "critical"
      ? "text-critical"
      : tone === "warn"
        ? "text-warn"
        : tone === "good"
          ? "text-good"
          : "text-ink";

  return (
    <Card className="p-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1.5 font-serif text-3xl font-semibold tnum ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-ink-soft">{hint}</div>}
    </Card>
  );
}

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Card className="p-10 text-center">
      <p className="font-serif text-lg font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">{body}</p>
    </Card>
  );
}
