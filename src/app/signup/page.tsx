import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.auth.signupTitle };
}

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const { next } = await searchParams;
  const target = typeof next === "string" && next.startsWith("/") ? next : "/dashboard";

  if (await getSessionUser()) redirect(target);

  const { t } = await getI18n();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <h1 className="font-serif text-3xl font-bold">{t.auth.signupTitle}</h1>
        <p className="mt-2 text-ink-soft">{t.auth.signupBody}</p>

        <Card className="mt-5 p-5">
          <SignupForm t={t} next={target} />
        </Card>

        <div className="mt-5 flex items-start gap-3 rounded-xl bg-good-soft p-4 text-good">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">{t.auth.privacyNote}</p>
        </div>

        <p className="mt-5 text-center text-ink-soft">
          {t.auth.haveAccount}{" "}
          <Link
            href={`/login?next=${encodeURIComponent(target)}`}
            className="font-semibold text-accent underline underline-offset-4"
          >
            {t.common.signIn}
          </Link>
        </p>
      </main>
    </>
  );
}
