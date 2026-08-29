import Link from "next/link";
import { ArrowRight, Clock, Gauge, MapPin, Radio, Users } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, Eyebrow } from "@/components/ui";
import { getSystemStats, formatHours, formatRate } from "@/lib/stats";

export const dynamic = "force-dynamic";

const STAGES = [
  ["01", "Complaint", "Citizen submits text via app, web or IVR."],
  ["02", "AI classification", "An LLM tags category, hazards and intent."],
  ["03", "Department detection", "Category maps to the responsible department."],
  ["04", "Priority calculation", "Severity, duration and location risk score it."],
  ["05", "Location detection", "Free text or GPS resolves to ward and zone."],
  ["06", "Nearest officer", "Jurisdiction plus workload picks the owner."],
  ["07", "Auto assignment", "Ticket and deadline land in the officer's queue."],
  ["08", "SLA monitoring", "A sweep watches the clock until it is resolved."],
];

const LADDER = [
  { at: "50%", label: "Reminder", who: "Field officer", tone: "text-ink-soft" },
  { at: "83%", label: "Warning", who: "Officer + supervisor", tone: "text-warn" },
  { at: "100%", label: "Escalate", who: "Supervisor", tone: "text-critical" },
  { at: "150%", label: "Escalate again", who: "Department head", tone: "text-critical" },
];

export default async function LandingPage() {
  const stats = await getSystemStats();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-24">
        {/* Hero */}
        <section className="border-b border-line py-16 sm:py-20">
          <Eyebrow>Smart India Hackathon · civic accountability</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            Complaints don&rsquo;t wait in a queue. They wait in the dark.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            CivicPulse reads a complaint written in plain language, works out
            which department owns it, how urgent it is and which ward it sits
            in, then assigns it to a named officer with a deadline already
            ticking &mdash; and escalates on its own when that deadline passes.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/report"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Report an issue
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2"
            >
              Officer sign in
            </Link>
          </div>

          <blockquote className="mt-10 max-w-2xl rounded-lg border border-line border-l-[3px] border-l-accent bg-surface p-4 shadow-card">
            <p className="italic text-ink-soft">
              &ldquo;Streetlight near XYZ school has not been working for 5
              days.&rdquo;
            </p>
            <cite className="mt-2 block font-mono text-[0.72rem] not-italic text-ink-faint">
              One sentence containing a category, a location, a safety signal
              and an age. CivicPulse extracts all four.
            </cite>
          </blockquote>
        </section>

        {/* Live numbers */}
        <section className="py-14">
          <Eyebrow>Live system state</Eyebrow>
          <h2 className="mt-3 font-serif text-2xl font-semibold">
            What the ledger says right now
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricTile
              icon={<Radio className="h-4 w-4" />}
              label="Complaints"
              value={stats.total}
            />
            <MetricTile
              icon={<Clock className="h-4 w-4" />}
              label="Open"
              value={stats.open}
            />
            <MetricTile
              icon={<Gauge className="h-4 w-4" />}
              label="Overdue now"
              value={stats.overdueNow}
              tone={stats.overdueNow > 0 ? "critical" : "default"}
            />
            <MetricTile
              icon={<Users className="h-4 w-4" />}
              label="Met SLA"
              value={formatRate(stats.complianceRate)}
              tone={
                stats.complianceRate !== null && stats.complianceRate < 0.7
                  ? "warn"
                  : "good"
              }
            />
            <MetricTile
              icon={<MapPin className="h-4 w-4" />}
              label="Avg resolution"
              value={formatHours(stats.avgResolutionHours)}
            />
          </div>
          {stats.total === 0 && (
            <p className="mt-4 text-sm text-ink-soft">
              No complaints yet. File one from{" "}
              <Link href="/report" className="text-accent underline underline-offset-2">
                the report page
              </Link>{" "}
              and watch it move through all eight stages.
            </p>
          )}
        </section>

        {/* Pipeline */}
        <section className="border-t border-line py-14">
          <Eyebrow>How a complaint moves</Eyebrow>
          <h2 className="mt-3 font-serif text-2xl font-semibold">
            Eight stages, zero manual handoffs
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map(([n, title, body]) => (
              <Card key={n} className="p-4">
                <div className="font-mono text-[0.7rem] tracking-wider text-ink-faint">
                  {n}
                </div>
                <div className="mt-1 font-medium">{title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
              </Card>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-accent-soft p-5 text-sm leading-relaxed text-accent-ink">
            <b className="font-semibold">
              The interesting part isn&rsquo;t any one stage &mdash; it&rsquo;s
              stage 8.
            </b>{" "}
            Classification and routing exist in plenty of ticketing tools. What
            makes this an accountability system is that the clock is enforced
            without anyone remembering to check it.
          </div>
        </section>

        {/* Escalation ladder */}
        <section className="border-t border-line py-14">
          <Eyebrow>The clock that runs itself</Eyebrow>
          <h2 className="mt-3 font-serif text-2xl font-semibold">
            Missing a deadline has automatic consequences
          </h2>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Each rung is a fraction of the ticket&rsquo;s own SLA, not a fixed
            hour count &mdash; so a four-hour clock on a burst water main and a
            week-long clock on tree trimming climb the same ladder at the same
            relative points.
          </p>

          <div className="mt-7 overflow-x-auto">
            <div className="flex min-w-[560px] items-stretch gap-3">
              {LADDER.map((rung, i) => (
                <div key={rung.at} className="flex flex-1 items-stretch gap-3">
                  <Card className="flex-1 p-4">
                    <div className="font-mono text-sm font-medium tnum">{rung.at}</div>
                    <div className={`mt-1 font-medium ${rung.tone}`}>{rung.label}</div>
                    <div className="mt-1 text-xs text-ink-soft">{rung.who}</div>
                  </Card>
                  {i < LADDER.length - 1 && (
                    <div className="flex items-center font-mono text-ink-faint">
                      &rarr;
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why more than a portal */}
        <section className="border-t border-line py-14">
          <Eyebrow>Why this is more than a portal</Eyebrow>
          <h2 className="mt-3 max-w-2xl font-serif text-2xl font-semibold">
            The complaint form is the easy part
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <p className="leading-relaxed text-ink-soft">
              Anyone can build a form that saves a complaint to a database.
              That already exists in most municipalities, and it hasn&rsquo;t
              solved the problem. What&rsquo;s missing is the loop after
              submission &mdash; something that keeps a complaint from dying
              silently in a forwarded email.
            </p>
            <p className="leading-relaxed text-ink-soft">
              CivicPulse&rsquo;s real output is the escalation ladder and the
              data trail it leaves: response times per officer, per department
              and per ward, all comparable. You can&rsquo;t manage what
              isn&rsquo;t measured, and today none of it is.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-2 px-5 font-mono text-xs text-ink-faint">
          <span>CivicPulse &middot; complaint triage and SLA escalation</span>
          <span>Next.js &middot; Postgres &middot; Prisma &middot; Groq</span>
        </div>
      </footer>
    </>
  );
}

function MetricTile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "critical" | "good";
}) {
  const toneClass =
    tone === "critical"
      ? "text-critical"
      : tone === "warn"
        ? "text-warn"
        : tone === "good"
          ? "text-good"
          : "text-ink";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-ink-faint">
        {icon}
        <span className="eyebrow">{label}</span>
      </div>
      <div className={`mt-2 font-serif text-3xl font-semibold tnum ${toneClass}`}>
        {value}
      </div>
    </Card>
  );
}
