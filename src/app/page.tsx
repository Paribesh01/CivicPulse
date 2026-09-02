import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  Clock,
  MessageSquare,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui";
import { getI18n } from "@/lib/i18n";
import { getSystemStats, formatHours, formatRate } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [{ t }, stats] = await Promise.all([getI18n(), getSystemStats()]);

  const steps = [
    {
      icon: <Camera className="h-7 w-7" />,
      title: t.home.step1Title,
      body: t.home.step1Body,
    },
    {
      icon: <MessageSquare className="h-7 w-7" />,
      title: t.home.step2Title,
      body: t.home.step2Body,
    },
    {
      icon: <Building2 className="h-7 w-7" />,
      title: t.home.step3Title,
      body: t.home.step3Body,
    },
    {
      icon: <Clock className="h-7 w-7" />,
      title: t.home.step4Title,
      body: t.home.step4Body,
    },
  ];

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-20">
        {/* Hero — one clear action, stated plainly */}
        <section className="py-10">
          <h1 className="font-serif text-4xl font-bold leading-tight sm:text-5xl">
            {t.home.heroTitle}
          </h1>
          <p className="mt-4 text-xl leading-relaxed text-ink-soft">
            {t.home.heroBody}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/report"
              className="inline-flex min-h-14 flex-1 items-center justify-center gap-2.5 rounded-xl bg-accent px-6 text-lg font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Camera className="h-6 w-6" />
              {t.home.ctaReport}
            </Link>
            <Link
              href="/track"
              className="inline-flex min-h-14 flex-1 items-center justify-center gap-2.5 rounded-xl border-2 border-line bg-surface px-6 text-lg font-semibold transition-colors hover:bg-surface-2"
            >
              <Search className="h-6 w-6" />
              {t.home.ctaTrack}
            </Link>
          </div>
        </section>

        {/* How it works — four numbered, icon-led cards */}
        <section className="border-t border-line py-10">
          <h2 className="font-serif text-2xl font-bold">{t.home.howItWorks}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {steps.map((step, i) => (
              <Card key={step.title} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                    {step.icon}
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-2xl font-bold text-accent">
                        {i + 1}
                      </span>
                      <h3 className="text-lg font-semibold">{step.title}</h3>
                    </div>
                    <p className="mt-1 text-ink-soft">{step.body}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Trust — the reason this is not another suggestion box */}
        <section className="border-t border-line py-10">
          <Card className="bg-accent-soft p-6">
            <div className="flex items-start gap-4">
              <ShieldCheck className="h-8 w-8 shrink-0 text-accent-ink" />
              <div>
                <h2 className="font-serif text-2xl font-bold text-accent-ink">
                  {t.home.trustTitle}
                </h2>
                <p className="mt-2 text-lg leading-relaxed text-accent-ink">
                  {t.home.trustBody}
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Live numbers */}
        <section className="border-t border-line py-10">
          <h2 className="font-serif text-2xl font-bold">{t.home.liveTitle}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              icon={<TrendingUp className="h-5 w-5" />}
              label={t.home.statComplaints}
              value={stats.total}
            />
            <Tile
              icon={<Clock className="h-5 w-5" />}
              label={t.home.statOpen}
              value={stats.open}
            />
            <Tile
              icon={<CheckCircle2 className="h-5 w-5" />}
              label={t.home.statOnTime}
              value={formatRate(stats.complianceRate)}
              tone={
                stats.complianceRate !== null && stats.complianceRate < 0.7
                  ? "warn"
                  : "good"
              }
            />
            <Tile
              icon={<Clock className="h-5 w-5" />}
              label={t.home.statAvg}
              value={formatHours(stats.avgResolutionHours)}
            />
          </div>
        </section>

        <section className="border-t border-line py-10">
          <Link
            href="/report"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-6 text-lg font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t.home.ctaReport}
            <ArrowRight className="h-6 w-6" />
          </Link>
          <p className="mt-5 text-center">
            <Link
              href="/login"
              className="text-ink-soft underline underline-offset-4 hover:text-ink"
            >
              {t.home.officerSignIn}
            </Link>
          </p>
        </section>
      </main>

      <footer className="border-t border-line py-6">
        <p className="mx-auto max-w-4xl px-4 text-center text-sm text-ink-faint">
          {t.common.appName} · {t.common.tagline}
        </p>
      </footer>
    </>
  );
}

function Tile({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "default" | "warn" | "good";
}) {
  const toneClass =
    tone === "warn" ? "text-warn" : tone === "good" ? "text-good" : "text-ink";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-ink-faint">{icon}</div>
      <div className={`mt-2 font-serif text-3xl font-bold tnum ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-ink-soft">{label}</div>
    </Card>
  );
}
