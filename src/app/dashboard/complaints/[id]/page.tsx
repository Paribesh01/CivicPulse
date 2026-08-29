import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SlaMeter } from "@/components/SlaMeter";
import { Timeline } from "@/components/Timeline";
import { Card, Eyebrow, PriorityPill, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canReassign, complaintScope } from "@/lib/scope";
import { requireStaff } from "@/lib/session";
import { formatDuration } from "@/lib/sla-status";
import { ComplaintActions } from "./ComplaintActions";

export const dynamic = "force-dynamic";

type PrioritySignal = { label: string; points: number };

export default async function ComplaintDetailPage({
  params,
}: PageProps<"/dashboard/complaints/[id]">) {
  const user = await requireStaff();
  const { id } = await params;

  // Scope is applied in the query itself, so an out-of-scope id is a 404
  // rather than a permission message that confirms the ticket exists.
  const complaint = await prisma.complaint.findFirst({
    where: { id, ...complaintScope(user) },
    include: {
      categoryRoute: { select: { label: true, group: true, key: true } },
      department: { select: { id: true, name: true } },
      ward: { select: { name: true, zone: true } },
      assignee: { select: { id: true, name: true } },
      citizen: { select: { name: true } },
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });

  if (!complaint) notFound();

  const mayReassign = canReassign(user);
  const officers = mayReassign
    ? await prisma.user.findMany({
        where: {
          role: "OFFICER",
          departmentId: complaint.departmentId ?? undefined,
          available: true,
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              assignedComplaints: {
                where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      })
    : [];

  const signals = (complaint.prioritySignals as PrioritySignal[] | null) ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to queue
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-semibold tnum">{complaint.code}</h1>
          <StatusPill status={complaint.status} />
          <PriorityPill
            priority={complaint.priority}
            score={complaint.priorityScore}
          />
          {complaint.escalationLevel > 0 && (
            <span className="rounded-full bg-critical-soft px-2.5 py-0.5 font-mono text-[0.7rem] text-critical">
              Escalated ×{complaint.escalationLevel}
            </span>
          )}
          {complaint.needsReview && (
            <span className="rounded-full bg-warn-soft px-2.5 py-0.5 font-mono text-[0.7rem] text-warn">
              Low confidence
            </span>
          )}
        </div>
        <p className="mt-3 max-w-3xl leading-relaxed">{complaint.rawText}</p>
        <p className="mt-2 font-mono text-xs text-ink-faint">
          Filed {complaint.createdAt.toLocaleString()} via {complaint.channel}
          {complaint.citizen ? ` by ${complaint.citizen.name}` : " (anonymous)"}
          {complaint.citizenPhone ? ` · ${complaint.citizenPhone}` : ""}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <Eyebrow>SLA</Eyebrow>
            <div className="mt-3">
              <SlaMeter
                assignedAt={complaint.assignedAt?.toISOString() ?? null}
                dueAt={complaint.dueAt?.toISOString() ?? null}
                resolvedAt={complaint.resolvedAt?.toISOString() ?? null}
              />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <Detail
                label="Target"
                value={
                  complaint.slaHours
                    ? formatDuration(complaint.slaHours * 3_600_000)
                    : "—"
                }
              />
              <Detail
                label="Assigned"
                value={complaint.assignedAt?.toLocaleString() ?? "Not yet"}
              />
              <Detail
                label="Due"
                value={complaint.dueAt?.toLocaleString() ?? "—"}
              />
              <Detail
                label="Resolved"
                value={complaint.resolvedAt?.toLocaleString() ?? "—"}
              />
            </dl>
            {complaint.resolutionNote && (
              <div className="mt-4 rounded-lg bg-good-soft p-3 text-sm text-good">
                <span className="eyebrow text-good">Resolution</span>
                <p className="mt-1">{complaint.resolutionNote}</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <Eyebrow>How it was triaged</Eyebrow>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail
                label="Category"
                value={
                  complaint.categoryRoute
                    ? `${complaint.categoryRoute.group} › ${complaint.categoryRoute.label}`
                    : "Unclassified"
                }
              />
              <Detail
                label="Confidence"
                value={
                  complaint.confidence !== null
                    ? `${Math.round(complaint.confidence * 100)}%`
                    : "—"
                }
              />
              <Detail
                label="Department"
                value={complaint.department?.name ?? "Not routed"}
              />
              <Detail
                label="Ward"
                value={
                  complaint.ward
                    ? `${complaint.ward.name}, ${complaint.ward.zone}`
                    : complaint.locationText ?? "Unresolved"
                }
              />
              <Detail
                label="Officer"
                value={complaint.assignee?.name ?? "Unassigned"}
              />
              <Detail
                label="Reported age"
                value={
                  complaint.reportedDurationDays !== null
                    ? `${complaint.reportedDurationDays} day(s)`
                    : "Not stated"
                }
              />
            </dl>

            {signals.length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <span className="eyebrow">Priority breakdown</span>
                <ul className="mt-2 space-y-1.5">
                  {signals.map((signal) => (
                    <li
                      key={signal.label}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="text-ink-soft">{signal.label}</span>
                      <span className="font-mono tnum text-accent-ink">
                        +{signal.points}
                      </span>
                    </li>
                  ))}
                  <li className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5 text-sm font-medium">
                    <span>Total</span>
                    <span className="font-mono tnum">
                      {complaint.priorityScore}/100
                    </span>
                  </li>
                </ul>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <Eyebrow>Timeline</Eyebrow>
            <div className="mt-4">
              <Timeline events={complaint.events} />
            </div>
          </Card>
        </div>

        <ComplaintActions
          complaintId={complaint.id}
          status={complaint.status}
          assigneeId={complaint.assigneeId}
          canReassign={mayReassign}
          officers={officers.map((o) => ({
            id: o.id,
            name: o.name,
            openCount: o._count.assignedComplaints,
          }))}
        />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[0.68rem] uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
