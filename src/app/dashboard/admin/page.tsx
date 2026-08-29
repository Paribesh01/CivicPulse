import { Card, Eyebrow } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuration" };

export default async function AdminPage() {
  await requireRole(["ADMIN"]);

  const [routes, wards, rules, staff] = await Promise.all([
    prisma.categoryRoute.findMany({
      include: { department: { select: { name: true, code: true } } },
      orderBy: [{ group: "asc" }, { label: "asc" }],
    }),
    prisma.ward.findMany({ orderBy: { code: "asc" } }),
    prisma.escalationRule.findMany({ orderBy: { sequence: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["OFFICER", "SUPERVISOR", "DEPT_HEAD"] } },
      include: {
        department: { select: { code: true } },
        ward: { select: { code: true } },
        _count: {
          select: {
            assignedComplaints: {
              where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
            },
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Eyebrow>Configuration</Eyebrow>
        <h1 className="mt-2 font-serif text-2xl font-semibold">
          Everything the router decides on is data
        </h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Department mappings, SLA hours, escalation thresholds and the officer
          roster are rows, not code. Onboarding a new city or department is a
          data load rather than a rebuild.
        </p>
      </div>

      <section>
        <Eyebrow>Escalation ladder</Eyebrow>
        <p className="mt-1.5 text-sm text-ink-soft">
          Fractions of each ticket&rsquo;s own SLA, so one ladder fits every
          category. A department row overrides the global ladder wholesale.
        </p>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <Th className="text-left">Rung</Th>
                <Th className="text-left">Fires at</Th>
                <Th className="text-left">Kind</Th>
                <Th className="text-left">Label</Th>
                <Th className="text-left">Escalates to</Th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-line last:border-b-0">
                  <Td>{rule.sequence}</Td>
                  <Td>{Math.round(rule.fraction * 100)}% of SLA</Td>
                  <Td>{rule.kind}</Td>
                  <Td className="font-sans text-ink">{rule.label}</Td>
                  <Td>{rule.notifyRole ?? "assignee only"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <Eyebrow>Category routes</Eyebrow>
        <p className="mt-1.5 text-sm text-ink-soft">
          The classifier can only return one of these {routes.length} keys,
          which is what stops the model inventing a department that
          doesn&rsquo;t exist.
        </p>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <Th className="text-left">Key</Th>
                <Th className="text-left">Category</Th>
                <Th className="text-left">Department</Th>
                <Th>Base SLA</Th>
                <Th>Severity</Th>
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.id} className="border-b border-line last:border-b-0">
                  <Td>{route.key}</Td>
                  <Td className="font-sans text-ink">
                    <span className="text-ink-faint">{route.group} › </span>
                    {route.label}
                  </Td>
                  <Td className="font-sans text-ink-soft">
                    {route.department.name}
                  </Td>
                  <Td>{route.baseSlaHours}h</Td>
                  <Td>{route.severityWeight}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <Eyebrow>Wards</Eyebrow>
        <p className="mt-1.5 text-sm text-ink-soft">
          Aliases are the landmarks the intake text is matched against before
          any geocoder is consulted.
        </p>
        <Card className="mt-3 divide-y divide-line">
          {wards.map((ward) => (
            <div key={ward.id} className="p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{ward.name}</span>
                <span className="font-mono text-xs text-ink-faint">
                  {ward.code} · {ward.zone}
                </span>
                {ward.lat !== null && ward.lng !== null && (
                  <span className="font-mono text-xs text-ink-faint">
                    {ward.lat.toFixed(4)}, {ward.lng.toFixed(4)}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ward.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[0.68rem] text-ink-soft"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <Eyebrow>Roster</Eyebrow>
        <p className="mt-1.5 text-sm text-ink-soft">
          Assignment picks from officers marked available, nearest ward first,
          lightest load second.
        </p>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <Th className="text-left">Name</Th>
                <Th className="text-left">Role</Th>
                <Th className="text-left">Dept</Th>
                <Th className="text-left">Ward</Th>
                <Th>Open</Th>
                <Th className="text-left">Status</Th>
              </tr>
            </thead>
            <tbody>
              {staff.map((person) => (
                <tr key={person.id} className="border-b border-line last:border-b-0">
                  <Td className="font-sans text-ink">{person.name}</Td>
                  <Td>{person.role}</Td>
                  <Td>{person.department?.code ?? "—"}</Td>
                  <Td>{person.ward?.code ?? "—"}</Td>
                  <Td>{person._count.assignedComplaints}</Td>
                  <Td>
                    <span className={person.available ? "text-good" : "text-warn"}>
                      {person.available ? "available" : "stood down"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <Eyebrow>SLA sweep</Eyebrow>
        <Card className="mt-3 p-5">
          <p className="text-sm text-ink-soft">
            Stage 8 runs as one sweep over every open ticket rather than a timer
            per ticket, so a restarted worker catches up instead of losing
            deadlines. Point a scheduler at it:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed">
{`*/5 * * * * curl -fsS -X POST \\
  -H "Authorization: Bearer $CRON_SECRET" \\
  https://<host>/api/cron/sla-sweep`}
          </pre>
        </Card>
      </section>
    </div>
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
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-3 font-mono text-xs text-ink-soft ${
        className.includes("font-sans") ? "" : "text-right"
      } ${className}`}
    >
      {children}
    </td>
  );
}
