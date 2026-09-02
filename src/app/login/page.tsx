import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.auth.loginTitle };
}

const DEMO_ACCOUNTS = [
  ["ravi@example.com", "Citizen · नागरिक"],
  ["je.elec.b@civicpulse.gov.in", "Field officer · अधिकारी"],
  ["sup.elec@civicpulse.gov.in", "Supervisor"],
  ["admin@civicpulse.gov.in", "Administrator"],
];

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/dashboard";

  if (await getSessionUser()) redirect(target);

  const { t } = await getI18n();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <h1 className="font-serif text-3xl font-bold">{t.auth.loginTitle}</h1>
        <p className="mt-2 text-ink-soft">{t.auth.loginBody}</p>

        <Card className="mt-5 p-5">
          <LoginForm t={t} next={target} />
        </Card>

        <p className="mt-5 text-center text-ink-soft">
          {t.auth.noAccount}{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(target)}`}
            className="font-semibold text-accent underline underline-offset-4"
          >
            {t.auth.createOne}
          </Link>
        </p>

        <Card className="mt-8 p-5">
          <h2 className="font-semibold">{t.auth.demoTitle}</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {t.auth.demoBody}{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm">
              civicpulse123
            </code>
          </p>
          <ul className="mt-3 space-y-2">
            {DEMO_ACCOUNTS.map(([email, role]) => (
              <li key={email} className="text-sm">
                <span className="font-mono">{email}</span>
                <span className="ml-2 text-ink-faint">{role}</span>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </>
  );
}
