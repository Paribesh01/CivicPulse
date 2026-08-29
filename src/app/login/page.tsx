import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, Eyebrow } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

const DEMO_ACCOUNTS = [
  ["je.elec.b@civicpulse.gov.in", "Field officer — Ward 14 electrical"],
  ["sup.elec@civicpulse.gov.in", "Supervisor — electrical"],
  ["head.elec@civicpulse.gov.in", "Department head — electrical"],
  ["admin@civicpulse.gov.in", "Administrator — sees everything"],
  ["ravi@example.com", "Citizen — Ward 14"],
];

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-5 py-14 md:grid-cols-2">
        <div>
          <Eyebrow>Sign in</Eyebrow>
          <h1 className="mt-3 font-serif text-3xl font-semibold">
            Welcome back
          </h1>
          <p className="mt-2 text-ink-soft">
            Officers see their queue and SLA clocks. Citizens see the status of
            everything they&rsquo;ve reported.
          </p>

          <Card className="mt-6 p-5">
            <LoginForm />
            <p className="mt-4 text-sm text-ink-soft">
              No account?{" "}
              <Link href="/signup" className="text-accent underline underline-offset-2">
                Create one
              </Link>
              . You can also{" "}
              <Link href="/report" className="text-accent underline underline-offset-2">
                report an issue without signing in
              </Link>
              .
            </p>
          </Card>
        </div>

        <div>
          <Eyebrow>Demo accounts</Eyebrow>
          <h2 className="mt-3 font-serif text-xl font-semibold">
            Seeded roles to try
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Every seeded account uses the password{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
              civicpulse123
            </code>
            .
          </p>
          <Card className="mt-4 divide-y divide-line">
            {DEMO_ACCOUNTS.map(([email, role]) => (
              <div key={email} className="p-3.5">
                <div className="font-mono text-xs text-ink">{email}</div>
                <div className="mt-0.5 text-xs text-ink-soft">{role}</div>
              </div>
            ))}
          </Card>
        </div>
      </main>
    </>
  );
}
