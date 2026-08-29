import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

/// The brief's actual product: response times per officer, per department and
/// per ward, made comparable. Aggregation happens in JS over a bounded window
/// rather than in SQL — at municipal volumes it is fast enough, and it keeps
/// the definition of "breach" in one readable place.

const OPEN_STATUSES = ["SUBMITTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS"] as const;

export type Grouped = {
  key: string;
  label: string;
  sublabel?: string;
  total: number;
  open: number;
  resolved: number;
  breachedOpen: number;
  missedSla: number;
  complianceRate: number | null;
  avgResolutionHours: number | null;
};

export type SystemStats = {
  total: number;
  open: number;
  resolved: number;
  overdueNow: number;
  escalated: number;
  complianceRate: number | null;
  avgResolutionHours: number | null;
  avgFirstResponseHours: number | null;
  autoRoutedRate: number | null;
  byDepartment: Grouped[];
  byWard: Grouped[];
  byOfficer: Grouped[];
  byPriority: { priority: string; count: number }[];
};

type Row = {
  id: string;
  status: string;
  priority: string;
  needsReview: boolean;
  assigneeId: string | null;
  assignedAt: Date | null;
  dueAt: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  escalationLevel: number;
  department: { id: string; name: string; code: string } | null;
  ward: { id: string; name: string; zone: string } | null;
  assignee: { id: string; name: string } | null;
};

function isOpen(row: Row): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(row.status);
}

function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}

function summarise(
  rows: Row[],
  key: string,
  label: string,
  sublabel: string | undefined,
  now: Date,
): Grouped {
  const open = rows.filter(isOpen);
  const resolved = rows.filter((r) => r.resolvedAt !== null);

  // Only tickets that actually carried a deadline can be judged against one.
  const judged = resolved.filter((r) => r.dueAt !== null);
  const met = judged.filter((r) => r.resolvedAt!.getTime() <= r.dueAt!.getTime());

  const durations = resolved
    .filter((r) => r.assignedAt !== null)
    .map((r) => hoursBetween(r.assignedAt!, r.resolvedAt!));

  return {
    key,
    label,
    sublabel,
    total: rows.length,
    open: open.length,
    resolved: resolved.length,
    breachedOpen: open.filter((r) => r.dueAt !== null && r.dueAt.getTime() < now.getTime())
      .length,
    missedSla: judged.length - met.length,
    complianceRate: judged.length > 0 ? met.length / judged.length : null,
    avgResolutionHours:
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : null,
  };
}

function groupBy(
  rows: Row[],
  pick: (row: Row) => { key: string; label: string; sublabel?: string } | null,
  now: Date,
): Grouped[] {
  const buckets = new Map<string, { meta: { key: string; label: string; sublabel?: string }; rows: Row[] }>();

  for (const row of rows) {
    const meta = pick(row);
    if (!meta) continue;
    const bucket = buckets.get(meta.key);
    if (bucket) bucket.rows.push(row);
    else buckets.set(meta.key, { meta, rows: [row] });
  }

  return [...buckets.values()]
    .map(({ meta, rows: bucketRows }) =>
      summarise(bucketRows, meta.key, meta.label, meta.sublabel, now),
    )
    .sort((a, b) => b.total - a.total);
}

export async function getSystemStats(
  where: Prisma.ComplaintWhereInput = {},
  now: Date = new Date(),
): Promise<SystemStats> {
  const rows = (await prisma.complaint.findMany({
    where,
    select: {
      id: true,
      status: true,
      priority: true,
      needsReview: true,
      assigneeId: true,
      assignedAt: true,
      dueAt: true,
      firstResponseAt: true,
      resolvedAt: true,
      createdAt: true,
      escalationLevel: true,
      department: { select: { id: true, name: true, code: true } },
      ward: { select: { id: true, name: true, zone: true } },
      assignee: { select: { id: true, name: true } },
    },
  })) as Row[];

  const overall = summarise(rows, "all", "All", undefined, now);

  const firstResponses = rows
    .filter((r) => r.firstResponseAt !== null && r.assignedAt !== null)
    .map((r) => hoursBetween(r.assignedAt!, r.firstResponseAt!));

  // "Auto-routed" means the classifier was confident enough that no human had
  // to look at it before it reached an officer.
  const autoRouted = rows.filter((r) => !r.needsReview && r.assigneeId !== null);

  const priorityCounts = new Map<string, number>();
  for (const row of rows) {
    priorityCounts.set(row.priority, (priorityCounts.get(row.priority) ?? 0) + 1);
  }

  return {
    total: rows.length,
    open: overall.open,
    resolved: overall.resolved,
    overdueNow: overall.breachedOpen,
    escalated: rows.filter((r) => r.escalationLevel > 0).length,
    complianceRate: overall.complianceRate,
    avgResolutionHours: overall.avgResolutionHours,
    avgFirstResponseHours:
      firstResponses.length > 0
        ? firstResponses.reduce((a, b) => a + b, 0) / firstResponses.length
        : null,
    autoRoutedRate: rows.length > 0 ? autoRouted.length / rows.length : null,
    byDepartment: groupBy(
      rows,
      (r) =>
        r.department
          ? { key: r.department.id, label: r.department.name, sublabel: r.department.code }
          : null,
      now,
    ),
    byWard: groupBy(
      rows,
      (r) => (r.ward ? { key: r.ward.id, label: r.ward.name, sublabel: r.ward.zone } : null),
      now,
    ),
    byOfficer: groupBy(
      rows,
      (r) => (r.assignee ? { key: r.assignee.id, label: r.assignee.name } : null),
      now,
    ),
    byPriority: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((priority) => ({
      priority,
      count: priorityCounts.get(priority) ?? 0,
    })),
  };
}

export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}
