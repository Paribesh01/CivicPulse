import Link from "next/link";
import { Activity, Award, CirclePlus, Search } from "lucide-react";
import { getSessionUser, isStaff } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { tierFor } from "@/lib/rewards";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { SignOutButton } from "./SignOutButton";

export async function SiteHeader() {
  const [user, { locale, t }] = await Promise.all([getSessionUser(), getI18n()]);
  const staff = isStaff(user?.role);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-accent" />
          <span className="font-serif text-xl font-semibold tracking-tight">
            {t.common.appName}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher current={locale} />

          {user ? (
            <>
              {/* Points are the reason to come back, so they sit in the
                  header rather than buried in a profile page. */}
              {!staff && (
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-good-soft px-3 font-semibold text-good"
                  title={t.rewards.title}
                >
                  <Award className="h-4 w-4" />
                  <span className="tnum">{user.points}</span>
                </Link>
              )}
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-medium">{user.name}</div>
                {!staff && (
                  <div className="text-xs text-ink-faint">
                    {t.tiers[tierFor(user.points).key]}
                  </div>
                )}
              </div>
              <SignOutButton label={t.common.signOut} />
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {t.common.signIn}
            </Link>
          )}
        </div>
      </div>

      {/* Primary navigation as large, icon-led targets rather than small text
          links — this is the whole app for a citizen. */}
      <nav className="mx-auto flex w-full max-w-6xl gap-2 px-4 pb-3">
        <Link
          href="/report"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-white transition-opacity hover:opacity-90 sm:flex-none"
        >
          <CirclePlus className="h-5 w-5" />
          {t.common.reportIssue}
        </Link>
        <Link
          href="/track"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold transition-colors hover:bg-surface-2 sm:flex-none"
        >
          <Search className="h-5 w-5" />
          {t.common.track}
        </Link>
        {staff && (
          <Link
            href="/dashboard"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-line bg-surface px-4 font-semibold transition-colors hover:bg-surface-2 sm:flex-none"
          >
            {t.common.dashboard}
          </Link>
        )}
      </nav>
    </header>
  );
}
