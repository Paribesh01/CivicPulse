import Link from "next/link";
import { Award, Camera, Clock } from "lucide-react";
import { SlaMeter } from "@/components/SlaMeter";
import { BigButton, Card, EmptyState, PriorityPill, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getPointsSummary, tierFor } from "@/lib/rewards";
import { photoVariant } from "@/lib/cloudinary";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import type { User } from "@/generated/prisma";

export async function CitizenDashboard({
  user,
  t,
  locale,
}: {
  user: User;
  t: Dictionary;
  locale: Locale;
}) {
  const [complaints, rewards] = await Promise.all([
    prisma.complaint.findMany({
      where: { citizenId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        code: true,
        rawText: true,
        status: true,
        priority: true,
        photoUrl: true,
        createdAt: true,
        assignedAt: true,
        dueAt: true,
        resolvedAt: true,
        department: { select: { name: true } },
        ward: { select: { name: true } },
      },
    }),
    getPointsSummary(user.id),
  ]);

  const tier = tierFor(rewards.points);
  const open = complaints.filter((c) =>
    ["SUBMITTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS"].includes(c.status),
  );
  const finished = complaints.filter((c) => !open.includes(c));

  const dateFmt = locale === "hi" ? "hi-IN" : "en-IN";

  return (
    <div className="space-y-8">
      {/* Points card — the reason to come back */}
      <Card className="overflow-hidden">
        <div className="bg-good-soft p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-good text-white">
              <Award className="h-8 w-8" />
            </div>
            <div>
              <div className="font-serif text-4xl font-bold tnum text-good">
                {rewards.points}
              </div>
              <div className="font-medium text-good">{t.common.points}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-sm text-ink-soft">{t.rewards.tier}</div>
              <div className="text-lg font-semibold">{t.tiers[tier.key]}</div>
            </div>
          </div>

          {tier.next && (
            <div className="mt-4">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-good transition-all"
                  style={{ width: `${Math.max(3, tier.progress * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                {tier.toNext} {t.common.points} {t.rewards.nextTier}{" "}
                <strong>{t.tiers[tier.next.key]}</strong>
              </p>
            </div>
          )}
        </div>

        {rewards.history.length > 0 && (
          <ul className="divide-y divide-line">
            {rewards.history.slice(0, 5).map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-sm text-ink-soft">
                  {t.rewards[entry.reason as keyof typeof t.rewards] ?? entry.reason}
                </span>
                {entry.complaint && (
                  <span className="font-mono text-xs text-ink-faint">
                    {entry.complaint.code}
                  </span>
                )}
                <span
                  className={`ml-auto font-semibold tnum ${
                    entry.delta >= 0 ? "text-good" : "text-critical"
                  }`}
                >
                  {entry.delta >= 0 ? "+" : ""}
                  {entry.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div>
        <h1 className="font-serif text-2xl font-bold">{t.dashboard.citizenTitle}</h1>
      </div>

      {complaints.length === 0 ? (
        <EmptyState
          title={t.dashboard.citizenEmpty}
          body={t.home.heroBody}
          action={
            <Link href="/report" className="w-full max-w-xs">
              <BigButton icon={<Camera className="h-5 w-5" />}>
                {t.dashboard.citizenEmptyCta}
              </BigButton>
            </Link>
          }
        />
      ) : (
        <>
          {open.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 font-semibold text-ink-soft">
                <Clock className="h-5 w-5" />
                {t.dashboard.open} ({open.length})
              </h2>
              <div className="mt-3 space-y-3">
                {open.map((c) => (
                  <ComplaintCard key={c.id} complaint={c} t={t} dateFmt={dateFmt} />
                ))}
              </div>
            </section>
          )}

          {finished.length > 0 && (
            <section>
              <h2 className="font-semibold text-ink-soft">
                {t.dashboard.closed} ({finished.length})
              </h2>
              <div className="mt-3 space-y-3">
                {finished.map((c) => (
                  <ComplaintCard key={c.id} complaint={c} t={t} dateFmt={dateFmt} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Link href="/report" className="block">
        <BigButton icon={<Camera className="h-5 w-5" />}>
          {t.common.reportIssue}
        </BigButton>
      </Link>
    </div>
  );
}

type CardComplaint = {
  id: string;
  code: string;
  rawText: string;
  status: "SUBMITTED" | "TRIAGED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REJECTED" | "DUPLICATE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  photoUrl: string | null;
  createdAt: Date;
  assignedAt: Date | null;
  dueAt: Date | null;
  resolvedAt: Date | null;
  department: { name: string } | null;
  ward: { name: string } | null;
};

function ComplaintCard({
  complaint,
  t,
  dateFmt,
}: {
  complaint: CardComplaint;
  t: Dictionary;
  dateFmt: string;
}) {
  return (
    <Link href={`/track/${complaint.code}`} className="block">
      <Card className="overflow-hidden transition-colors hover:bg-surface-2">
        <div className="flex gap-4 p-4">
          {complaint.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoVariant(complaint.photoUrl, "thumb")}
              alt=""
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
              loading="lazy"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold tnum">
                {complaint.code}
              </span>
              <StatusPill
                status={complaint.status}
                label={t.status[complaint.status]}
              />
              <PriorityPill
                priority={complaint.priority}
                label={t.urgency[complaint.priority]}
              />
            </div>
            <p className="mt-2 line-clamp-2">{complaint.rawText}</p>
            <p className="mt-1 text-sm text-ink-faint">
              {complaint.department?.name}
              {complaint.ward ? ` · ${complaint.ward.name}` : ""} ·{" "}
              {t.dashboard.filedOn}{" "}
              {complaint.createdAt.toLocaleDateString(dateFmt)}
            </p>
          </div>
        </div>
        <div className="border-t border-line px-4 py-3">
          <SlaMeter
            assignedAt={complaint.assignedAt?.toISOString() ?? null}
            dueAt={complaint.dueAt?.toISOString() ?? null}
            resolvedAt={complaint.resolvedAt?.toISOString() ?? null}
          />
        </div>
      </Card>
    </Link>
  );
}
