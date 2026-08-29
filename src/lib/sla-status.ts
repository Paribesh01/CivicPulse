/// Pure SLA math, shared by the sweep job and the client-side countdowns.
/// No database or server imports here so client components can use it too.

export type SlaTone = "none" | "ok" | "warn" | "breach" | "met" | "missed";

export type SlaState = {
  tone: SlaTone;
  /// 0 at assignment, 1 at the deadline, >1 once breached.
  fraction: number;
  remainingMs: number;
  overdue: boolean;
  label: string;
};

const WARN_FRACTION = 0.833;

export function slaState(
  complaint: {
    assignedAt: Date | string | null;
    dueAt: Date | string | null;
    resolvedAt: Date | string | null;
  },
  now: Date = new Date(),
): SlaState {
  const dueAt = complaint.dueAt ? new Date(complaint.dueAt) : null;
  const assignedAt = complaint.assignedAt ? new Date(complaint.assignedAt) : null;

  if (!dueAt || !assignedAt) {
    return {
      tone: "none",
      fraction: 0,
      remainingMs: 0,
      overdue: false,
      label: "No clock running",
    };
  }

  // A resolved ticket's outcome is fixed — it either beat its deadline or it
  // did not, and later sweeps must not keep re-judging it.
  if (complaint.resolvedAt) {
    const resolvedAt = new Date(complaint.resolvedAt);
    const met = resolvedAt.getTime() <= dueAt.getTime();
    return {
      tone: met ? "met" : "missed",
      fraction: 1,
      remainingMs: dueAt.getTime() - resolvedAt.getTime(),
      overdue: !met,
      label: met
        ? `Resolved ${formatDuration(dueAt.getTime() - resolvedAt.getTime())} inside SLA`
        : `Resolved ${formatDuration(resolvedAt.getTime() - dueAt.getTime())} late`,
    };
  }

  const total = dueAt.getTime() - assignedAt.getTime();
  const elapsed = now.getTime() - assignedAt.getTime();
  const remainingMs = dueAt.getTime() - now.getTime();
  const fraction = total > 0 ? elapsed / total : 1;

  if (remainingMs <= 0) {
    return {
      tone: "breach",
      fraction,
      remainingMs,
      overdue: true,
      label: `${formatDuration(-remainingMs)} overdue`,
    };
  }

  return {
    tone: fraction >= WARN_FRACTION ? "warn" : "ok",
    fraction,
    remainingMs,
    overdue: false,
    label: `${formatDuration(remainingMs)} left`,
  };
}

export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) {
    const rh = hours % 24;
    return rh > 0 ? `${days}d ${rh}h` : `${days}d`;
  }
  if (hours >= 1) {
    const rm = minutes % 60;
    return rm > 0 ? `${hours}h ${rm}m` : `${hours}h`;
  }
  if (minutes >= 1) return `${minutes}m`;
  return "under a minute";
}

export function formatRelative(value: Date | string, now: Date = new Date()): string {
  const date = new Date(value);
  const diff = now.getTime() - date.getTime();
  if (Math.abs(diff) < 60_000) return "just now";
  return diff >= 0 ? `${formatDuration(diff)} ago` : `in ${formatDuration(-diff)}`;
}
