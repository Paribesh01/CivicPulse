import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Camera, CircleAlert, Clock, MapPin, User } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SlaMeter } from "@/components/SlaMeter";
import { Timeline } from "@/components/Timeline";
import { BigButton, Card, PriorityPill, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getI18n } from "@/lib/i18n";
import { photoVariant } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/track/[code]">) {
  const { code } = await params;
  return { title: decodeURIComponent(code) };
}

export default async function TrackPage({ params }: PageProps<"/track/[code]">) {
  const [{ code }, { t, locale }] = await Promise.all([params, getI18n()]);

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

  // Public page: it shows what happened and who owns it, never who reported
  // it. Identity is known to the system and to staff, not to the internet.
  const dateFmt = locale === "hi" ? "hi-IN" : "en-IN";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-bold tnum">{complaint.code}</h1>
          <StatusPill status={complaint.status} label={t.status[complaint.status]} />
          <PriorityPill
            priority={complaint.priority}
            label={t.urgency[complaint.priority]}
          />
        </div>

        {complaint.escalationLevel > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-critical-soft px-3 py-2 font-medium text-critical">
            <CircleAlert className="h-5 w-5" />×{complaint.escalationLevel}
          </p>
        )}

        {complaint.photoUrl && (
          <div className="mt-5 overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoVariant(complaint.photoUrl, "card")}
              alt=""
              className="w-full object-cover"
            />
          </div>
        )}

        <p className="mt-5 text-lg leading-relaxed">{complaint.rawText}</p>

        <Card className="mt-6 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Clock className="h-5 w-5 text-accent" />
            {t.track.deadline}
          </h2>
          <div className="mt-3">
            <SlaMeter
              assignedAt={complaint.assignedAt?.toISOString() ?? null}
              dueAt={complaint.dueAt?.toISOString() ?? null}
              resolvedAt={complaint.resolvedAt?.toISOString() ?? null}
            />
          </div>
          {complaint.dueAt && (
            <p className="mt-3 text-ink-soft">
              {complaint.dueAt.toLocaleString(dateFmt)}
            </p>
          )}

          {complaint.resolutionNote && (
            <div className="mt-4 rounded-xl bg-good-soft p-4">
              <p className="font-semibold text-good">{t.track.resolution}</p>
              <p className="mt-1 text-good">{complaint.resolutionNote}</p>
            </div>
          )}
        </Card>

        <Card className="mt-4 p-5">
          <dl className="space-y-4">
            <Detail
              icon={<Building2 className="h-5 w-5" />}
              label={t.track.goesTo}
              value={complaint.department?.name ?? "—"}
            />
            <Detail
              icon={<MapPin className="h-5 w-5" />}
              label={t.track.area}
              value={
                complaint.ward
                  ? `${complaint.ward.name}, ${complaint.ward.zone}`
                  : complaint.locationText ?? "—"
              }
            />
            <Detail
              icon={<User className="h-5 w-5" />}
              label={t.track.officer}
              value={complaint.assignee?.name ?? "—"}
            />
          </dl>
        </Card>

        <Card className="mt-4 p-5">
          <h2 className="font-semibold">{t.track.whatHappened}</h2>
          <div className="mt-4">
            <Timeline events={complaint.events} />
          </div>
        </Card>

        <p className="mt-6 text-center text-ink-soft">{t.track.stillBroken}</p>

        <div className="mt-4">
          <Link href="/report" className="block">
            <BigButton icon={<Camera className="h-5 w-5" />}>
              {t.common.reportIssue}
            </BigButton>
          </Link>
        </div>
      </main>
    </>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-ink-faint">{icon}</span>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="ml-auto text-right font-medium">{value}</dd>
    </div>
  );
}
