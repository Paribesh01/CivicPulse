import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { isStaff, requireUser } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const user = await requireUser();
  const staff = isStaff(user.role);

  return (
    <>
      <SiteHeader />
      <div className="border-b border-line bg-surface">
        <nav className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-5">
          <TabLink href="/dashboard">
            {staff ? "Queue" : "My complaints"}
          </TabLink>
          {staff && <TabLink href="/dashboard/analytics">Accountability</TabLink>}
          {user.role === "ADMIN" && <TabLink href="/dashboard/admin">Configuration</TabLink>}
        </nav>
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">{children}</main>
    </>
  );
}

function TabLink({
  href,
  children,
}: {
  href: "/dashboard" | "/dashboard/analytics" | "/dashboard/admin";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-ink-soft transition-colors hover:border-line hover:text-ink"
    >
      {children}
    </Link>
  );
}
