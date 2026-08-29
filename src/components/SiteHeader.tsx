import Link from "next/link";
import { Activity } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { isStaff } from "@/lib/session";
import { SignOutButton } from "./SignOutButton";

const ROLE_LABEL: Record<string, string> = {
  CITIZEN: "Citizen",
  OFFICER: "Field officer",
  SUPERVISOR: "Supervisor",
  DEPT_HEAD: "Department head",
  ADMIN: "Administrator",
};

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          <span className="font-serif text-lg font-semibold tracking-tight">
            CivicPulse
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 text-sm sm:flex">
          <Link
            href="/report"
            className="rounded-lg px-2.5 py-1.5 text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Report an issue
          </Link>
          <Link
            href="/track"
            className="rounded-lg px-2.5 py-1.5 text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
          >
            Track
          </Link>
          {isStaff(user?.role) && (
            <Link
              href="/dashboard"
              className="rounded-lg px-2.5 py-1.5 text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Dashboard
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-xs font-medium">{user.name}</div>
                <div className="font-mono text-[0.68rem] text-ink-faint">
                  {ROLE_LABEL[user.role] ?? user.role}
                </div>
              </div>
              {!isStaff(user.role) && (
                <Link
                  href="/dashboard"
                  className="rounded-lg px-2.5 py-1.5 text-xs text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  My complaints
                </Link>
              )}
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                Sign in
              </Link>
              <Link
                href="/report"
                className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              >
                Report an issue
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
