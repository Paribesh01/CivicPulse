import Link from "next/link";
import { ComplaintRow } from "@/components/ComplaintRow";
import { Card, EmptyState, Eyebrow, Stat } from "@/components/ui";
import { prisma } from "@/lib/db";
import { complaintScope } from "@/lib/scope";
import { requireUser, isStaff } from "@/lib/session";
import { formatHours, formatRate, getSystemStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const SELECT = {
  id: true,
  code: true,
  rawText: true,
  status: true,
  priority: true,
  priorityScore: true,
  escalationLevel: true,
  assignedAt: true,
  dueAt: true,
  resolvedAt: true,
  categoryRoute: { select: { label: true, group: true } },
  ward: { select: { name: true, zone: true } },
  assignee: { select: { name: true } },
  department: { select: { name: true } },
} as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const scope = complaintScope(user);
  const staff = isStaff(user.role);

  const now = new Date();

  const [openComplaints, recentlyClosed, stats, unassigned] = await Promise.all([
    prisma.complaint.findMany({
      where: { ...scope, status: { in: ["SUBMITTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS"] } },
      // Overdue first, then by how close the deadline is. Priority breaks
      // ties, not the other way round — a critical ticket with two days left
      // is less urgent than a routine one that breached this morning.
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 60,
      select: SELECT,
    }),
    prisma.complaint.findMany({
      where: { ...scope, status: { in: ["RESOLVED", "CLOSED"] } },
      orderBy: { resolvedAt: "desc" },
      take: 8,
      select: SELECT,
    }),
    getSystemStats(scope, now),
    staff && user.role !== "OFFICER"
      ? prisma.complaint.findMany({
          where: { ...scope, assigneeId: null, status: { in: ["SUBMITTED", "TRIAGED"] } },
          orderBy: { priority: "desc" },
          take: 20,
          select: SELECT,
        })
      : Promise.resolve([]),
  ]);

  const overdue = openComplaints.filter(
    (c) => c.dueAt !== null && c.dueAt.getTime() < now.getTime(),
  );
  const onClock = openComplaints.filter(
    (c) => !(c.dueAt !== null && c.dueAt.getTime() < now.getTime()),
  );

  // Staff get the working view with actions; citizens get the public tracking
  // page, which is addressed by ticket code rather than id.
  const detailHref = (complaint: { id: string; code: string }) =>
    staff ? `/dashboard/complaints/${complaint.id}` : `/track/${complaint.code}`;

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>
          {user.role === "OFFICER"
            ? "Your queue"
            : staff
              ? "Department queue"
              : "Your complaints"}
        </Eyebrow>
        <h1 className="mt-2 font-serif text-2xl font-semibold">
          {greeting(user.name)}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open" value={stats.open} />
        <Stat
          label="Overdue now"
          value={stats.overdueNow}
          tone={stats.overdueNow > 0 ? "critical" : "good"}
          hint={stats.overdueNow > 0 ? "Past deadline, still open" : "Nothing breached"}
        />
        <Stat
          label="Met SLA"
          value={formatRate(stats.complianceRate)}
          tone={
            stats.complianceRate !== null && stats.complianceRate < 0.7 ? "warn" : "good"
          }
          hint="Of resolved tickets"
        />
        <Stat
          label="Avg resolution"
          value={formatHours(stats.avgResolutionHours)}
          hint="Assignment to resolved"
        />
      </div>

      {unassigned.length > 0 && (
        <section>
          <Eyebrow>Needs a human</Eyebrow>
          <h2 className="mt-2 font-serif text-lg font-semibold">
            {unassigned.length} ticket{unassigned.length === 1 ? "" : "s"} the
            router couldn&rsquo;t place
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            No available officer matched, or the classifier wasn&rsquo;t
            confident enough to route unattended. These have no clock running
            yet.
          </p>
          <Card className="mt-3">
            {unassigned.map((complaint) => (
              <ComplaintRow
                key={complaint.id}
                complaint={complaint}
                href={detailHref(complaint)}
                showAssignee
              />
            ))}
          </Card>
        </section>
      )}

      {overdue.length > 0 && (
        <section>
          <Eyebrow>Breached</Eyebrow>
          <h2 className="mt-2 font-serif text-lg font-semibold text-critical">
            {overdue.length} past deadline
          </h2>
          <Card className="mt-3 border-critical/30">
            {overdue.map((complaint) => (
              <ComplaintRow
                key={complaint.id}
                complaint={complaint}
                href={detailHref(complaint)}
                showAssignee={staff && user.role !== "OFFICER"}
              />
            ))}
          </Card>
        </section>
      )}

      <section>
        <Eyebrow>On the clock</Eyebrow>
        <h2 className="mt-2 font-serif text-lg font-semibold">
          {onClock.length} open, deadline nearest first
        </h2>
        <div className="mt-3">
          {onClock.length === 0 ? (
            <EmptyState
              title={staff ? "Queue is clear" : "Nothing open"}
              body={
                staff
                  ? "Every ticket in your scope is either resolved or waiting on assignment."
                  : "You have no complaints in progress. Report an issue and it will appear here with its deadline."
              }
            />
          ) : (
            <Card>
              {onClock.map((complaint) => (
                <ComplaintRow
                  key={complaint.id}
                  complaint={complaint}
                  href={detailHref(complaint)}
                  showAssignee={staff && user.role !== "OFFICER"}
                />
              ))}
            </Card>
          )}
        </div>
      </section>

      {recentlyClosed.length > 0 && (
        <section>
          <Eyebrow>Recently closed</Eyebrow>
          <Card className="mt-3">
            {recentlyClosed.map((complaint) => (
              <ComplaintRow
                key={complaint.id}
                complaint={complaint}
                href={detailHref(complaint)}
                showAssignee={staff && user.role !== "OFFICER"}
              />
            ))}
          </Card>
        </section>
      )}

      {!staff && (
        <p className="text-sm text-ink-soft">
          Something else broken?{" "}
          <Link href="/report" className="text-accent underline underline-offset-2">
            Report it
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function greeting(name: string): string {
  const first = name.split(" ")[0];
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${part}, ${first}`;
}
