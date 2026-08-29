import { Card, Eyebrow, Stat } from "@/components/ui";
import { complaintScope } from "@/lib/scope";
import { requireStaff } from "@/lib/session";
import {
  formatHours,
  formatRate,
  getSystemStats,
  type Grouped,
} from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accountability" };

export default async function AnalyticsPage() {
  const user = await requireStaff();
  const stats = await getSystemStats(complaintScope(user));

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>Accountability</Eyebrow>
        <h1 className="mt-2 font-serif text-2xl font-semibold">
          Response times, made comparable
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          The escalation ladder produces this table as a side effect. Before
          CivicPulse, none of these numbers existed &mdash; each complaint
          disappeared as an isolated case.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Met SLA"
          value={formatRate(stats.complianceRate)}
          hint="Of tickets with a deadline"
          tone={
            stats.complianceRate !== null && stats.complianceRate < 0.7
              ? "warn"
              : "good"
          }
        />
        <Stat
          label="Avg resolution"
          value={formatHours(stats.avgResolutionHours)}
          hint="Assignment to resolved"
        />
        <Stat
          label="Avg first touch"
          value={formatHours(stats.avgFirstResponseHours)}
          hint="How long before someone acted"
        />
        <Stat
          label="Auto-routed"
          value={formatRate(stats.autoRoutedRate)}
          hint="No human triage needed"
        />
      </div>

      <section>
        <Eyebrow>Priority mix</Eyebrow>
        <Card className="mt-3 p-5">
          <div className="space-y-3">
            {stats.byPriority.map(({ priority, count }) => {
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              const tone =
                priority === "CRITICAL"
                  ? "bg-critical"
                  : priority === "HIGH"
                    ? "bg-warn"
                    : priority === "MEDIUM"
                      ? "bg-accent"
                      : "bg-line";
              return (
                <div key={priority}>
                  <div className="flex items-baseline justify-between font-mono text-xs">
                    <span className="text-ink-soft">{priority}</span>
                    <span className="tnum text-ink-faint">
                      {count} · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full ${tone}`}
                      style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <GroupTable
        title="By department"
        caption="Which departments are keeping their own clocks."
        rows={stats.byDepartment}
        firstColumn="Department"
      />
      <GroupTable
        title="By ward"
        caption="Where complaints cluster, and where they go stale."
        rows={stats.byWard}
        firstColumn="Ward"
      />
      <GroupTable
        title="By officer"
        caption="Load and turnaround per person. Visible on purpose — this is what makes the ladder mean something."
        rows={stats.byOfficer}
        firstColumn="Officer"
      />
    </div>
  );
}

function GroupTable({
  title,
  caption,
  rows,
  firstColumn,
}: {
  title: string;
  caption: string;
  rows: Grouped[];
  firstColumn: string;
}) {
  return (
    <section>
      <Eyebrow>{title}</Eyebrow>
      <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{caption}</p>
      <Card className="mt-3 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft">Nothing recorded yet.</p>
        ) : (
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <Th className="text-left">{firstColumn}</Th>
                <Th>Total</Th>
                <Th>Open</Th>
                <Th>Overdue</Th>
                <Th>Missed SLA</Th>
                <Th>Met SLA</Th>
                <Th>Avg resolution</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.label}</div>
                    {row.sublabel && (
                      <div className="font-mono text-[0.68rem] text-ink-faint">
                        {row.sublabel}
                      </div>
                    )}
                  </td>
                  <Td>{row.total}</Td>
                  <Td>{row.open}</Td>
                  <Td tone={row.breachedOpen > 0 ? "critical" : undefined}>
                    {row.breachedOpen}
                  </Td>
                  <Td tone={row.missedSla > 0 ? "warn" : undefined}>
                    {row.missedSla}
                  </Td>
                  <Td
                    tone={
                      row.complianceRate === null
                        ? undefined
                        : row.complianceRate < 0.7
                          ? "warn"
                          : "good"
                    }
                  >
                    {formatRate(row.complianceRate)}
                  </Td>
                  <Td>{formatHours(row.avgResolutionHours)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}

function Th({
  children,
  className = "text-right",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2.5 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "critical" | "warn" | "good";
}) {
  const toneClass =
    tone === "critical"
      ? "text-critical"
      : tone === "warn"
        ? "text-warn"
        : tone === "good"
          ? "text-good"
          : "text-ink-soft";
  return (
    <td className={`px-4 py-3 text-right font-mono tnum ${toneClass}`}>{children}</td>
  );
}
