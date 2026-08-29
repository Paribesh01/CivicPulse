import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SlaMeter } from "@/components/SlaMeter";
import { Timeline } from "@/components/Timeline";
import { Card, Eyebrow, PriorityPill, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDuration } from "@/lib/sla-status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/track/[code]">) {
  const { code } = await params;
  return { title: `${decodeURIComponent(code)}` };
}

export default async function TrackPage({ params }: PageProps<"/track/[code]">) {
  const { code } = await params;

  const complaint = await prisma.complaint.findUnique({
    where: { code: decodeURIComponent(code).toUpperCase() },
    include: {
      categoryRoute: { select: { label: true, group: true } },
      department: { select: { name: true } },
      ward: { select: { name: true, zone: true } },
      assignee: { select: { name: true } },
      events: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true } } },
      },
    },
  });

  if (!complaint) notFound();

  // Public page: show what happened and who owns it, but not the citizen's
  // phone number or the officer's contact details.
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-12">
        <Eyebrow>Complaint status</Eyebrow>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-semibold tnum">
            {complaint.code}
          </h1>
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
        </div>

        <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
          &ldquo;{complaint.rawText}&rdquo;
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5">
            <Card className="p-5">
              <Eyebrow>Deadline</Eyebrow>
              <div className="mt-3">
                <SlaMeter
                  assignedAt={complaint.assignedAt?.toISOString() ?? null}
                  dueAt={complaint.dueAt?.toISOString() ?? null}
                  resolvedAt={complaint.resolvedAt?.toISOString() ?? null}
                />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Detail
                  label="Target"
                  value={
                    complaint.slaHours
                      ? formatDuration(complaint.slaHours * 3_600_000)
                      : "—"
                  }
                />
                <Detail
                  label="Due"
                  value={
                    complaint.dueAt
                      ? complaint.dueAt.toLocaleString()
                      : "Not started"
                  }
                />
                <Detail
                  label="Filed"
                  value={complaint.createdAt.toLocaleString()}
                />
                <Detail
                  label="Resolved"
                  value={
                    complaint.resolvedAt
                      ? complaint.resolvedAt.toLocaleString()
                      : "—"
                  }
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
              <Eyebrow>Everything that happened</Eyebrow>
              <div className="mt-4">
                <Timeline events={complaint.events} />
              </div>
            </Card>
          </div>

          <Card className="h-fit p-5">
            <Eyebrow>Routing</Eyebrow>
            <dl className="mt-3 space-y-3 text-sm">
              <Detail
                label="Category"
                value={
                  complaint.categoryRoute
                    ? `${complaint.categoryRoute.group} › ${complaint.categoryRoute.label}`
                    : "Unclassified"
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
                    : complaint.locationText ?? "Not resolved"
                }
              />
              <Detail
                label="Officer"
                value={complaint.assignee?.name ?? "Awaiting assignment"}
              />
            </dl>

            <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-faint">
              If this was marked resolved but the problem is still there, sign
              in and reopen it &mdash; reopening restarts the accountability
              trail rather than starting a new complaint.
            </p>
            <Link
              href="/report"
              className="mt-3 inline-block text-sm text-accent underline underline-offset-2"
            >
              Report something else
            </Link>
          </Card>
        </div>
      </main>
    </>
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
