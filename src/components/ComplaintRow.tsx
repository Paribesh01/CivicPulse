import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SlaMeter } from "@/components/SlaMeter";
import { PriorityPill, StatusPill } from "@/components/ui";
import { photoVariant } from "@/lib/cloudinary";
import type { ComplaintStatus, Priority } from "@/generated/prisma";

export type ComplaintRowData = {
  id: string;
  code: string;
  rawText: string;
  photoUrl?: string | null;
  status: ComplaintStatus;
  priority: Priority;
  priorityScore: number | null;
  escalationLevel: number;
  assignedAt: Date | null;
  dueAt: Date | null;
  resolvedAt: Date | null;
  categoryRoute: { label: string; group: string } | null;
  ward: { name: string; zone: string } | null;
  assignee: { name: string } | null;
  department?: { name: string } | null;
};

export function ComplaintRow({
  complaint,
  href,
  showAssignee = false,
}: {
  complaint: ComplaintRowData;
  href: string;
  showAssignee?: boolean;
}) {
  return (
    <Link
      href={href as never}
      className="group block border-b border-line p-4 transition-colors last:border-b-0 hover:bg-surface-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium tnum">{complaint.code}</span>
        <PriorityPill priority={complaint.priority} score={complaint.priorityScore} />
        <StatusPill status={complaint.status} />
        {complaint.escalationLevel > 0 && (
          <span className="rounded-full bg-critical-soft px-2 py-0.5 font-mono text-[0.68rem] text-critical">
            ↑{complaint.escalationLevel}
          </span>
        )}
        <ArrowUpRight className="ml-auto h-4 w-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      <div className="mt-2 flex gap-3">
        {complaint.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoVariant(complaint.photoUrl, "thumb")}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
            loading="lazy"
          />
        )}
        <p className="line-clamp-2 text-sm leading-relaxed text-ink">
          {complaint.rawText}
        </p>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.7rem] text-ink-faint">
        <span>{complaint.categoryRoute?.label ?? "Unclassified"}</span>
        {complaint.ward && (
          <span>
            {complaint.ward.name} · {complaint.ward.zone}
          </span>
        )}
        {complaint.department && <span>{complaint.department.name}</span>}
        {showAssignee && (
          <span>{complaint.assignee?.name ?? "Unassigned"}</span>
        )}
      </div>

      <div className="mt-3 max-w-xs">
        <SlaMeter
          assignedAt={complaint.assignedAt?.toISOString() ?? null}
          dueAt={complaint.dueAt?.toISOString() ?? null}
          resolvedAt={complaint.resolvedAt?.toISOString() ?? null}
        />
      </div>
    </Link>
  );
}
