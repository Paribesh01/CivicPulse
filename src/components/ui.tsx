import type { ComplaintStatus, Priority } from "@/generated/prisma";
import type { ReactNode } from "react";

/// Shared primitives. Sizing here is deliberately generous — the target user
/// is on a mid-range Android phone, often outdoors, often not a confident
/// reader. Touch targets stay at or above 44px and nothing important is
/// conveyed by colour alone.

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
  CRITICAL: "bg-critical text-white",
  HIGH: "bg-warn text-white",
  MEDIUM: "bg-accent text-white",
  LOW: "bg-surface-2 text-ink-soft",
};

const PRIORITY_FALLBACK: Record<Priority, string> = {
  CRITICAL: "Emergency",
  HIGH: "Urgent",
  MEDIUM: "Normal",
  LOW: "Low",
};

export function PriorityPill({
  priority,
  score,
  label,
}: {
  priority: Priority;
  score?: number | null;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${PRIORITY_STYLES[priority]}`}
    >
      {label ?? PRIORITY_FALLBACK[priority]}
      {typeof score === "number" && (
        <span className="tnum text-xs opacity-80">{score}</span>
      )}
    </span>
  );
}

const STATUS_FALLBACK: Record<ComplaintStatus, string> = {
  SUBMITTED: "Received",
  TRIAGED: "Waiting for an officer",
  ASSIGNED: "With an officer",
  IN_PROGRESS: "Work started",
  RESOLVED: "Fixed",
  CLOSED: "Closed",
  REJECTED: "Not accepted",
  DUPLICATE: "Duplicate",
};

const STATUS_STYLES: Record<ComplaintStatus, string> = {
  SUBMITTED: "bg-surface-2 text-ink-soft",
  TRIAGED: "bg-warn-soft text-warn",
  ASSIGNED: "bg-accent-soft text-accent-ink",
  IN_PROGRESS: "bg-accent-soft text-accent-ink",
  RESOLVED: "bg-good-soft text-good",
  CLOSED: "bg-surface-2 text-ink-soft",
  REJECTED: "bg-critical-soft text-critical",
  DUPLICATE: "bg-surface-2 text-ink-faint",
};

export function StatusPill({
  status,
  label,
}: {
  status: ComplaintStatus;
  label?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${STATUS_STYLES[status]}`}
    >
      {label ?? STATUS_FALLBACK[status]}
    </span>
  );
}

export function statusLabel(status: ComplaintStatus): string {
  return STATUS_FALLBACK[status];
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "critical" | "good";
  icon?: ReactNode;
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
      <div className="flex items-center gap-1.5 text-ink-faint">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className={`mt-1.5 font-serif text-3xl font-semibold tnum ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-sm text-ink-soft">{hint}</div>}
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-10 text-center">
      <p className="font-serif text-xl font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-ink-soft">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Card>
  );
}

/// The primary action on any citizen-facing screen. Full width on mobile,
/// large text, always paired with an icon.
export function BigButton({
  children,
  icon,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  className = "",
}: {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const variantClass =
    variant === "primary"
      ? "bg-accent text-white hover:opacity-90"
      : variant === "danger"
        ? "bg-critical text-white hover:opacity-90"
        : "border-2 border-line bg-surface text-ink hover:bg-surface-2";

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl px-5 text-base font-semibold transition-opacity disabled:opacity-50 ${variantClass} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

/// Numbered progress for the guided report flow. Shows position without
/// relying on reading — the filled dots carry the meaning.
export function StepDots({
  total,
  current,
  label,
}: {
  total: number;
  current: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 rounded-full transition-all ${
              i < current ? "w-8 bg-accent" : "w-2.5 bg-line"
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-ink-soft">{label}</span>
    </div>
  );
}
