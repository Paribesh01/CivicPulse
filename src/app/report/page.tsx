import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getSessionUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { isPhotoStorageConfigured } from "@/lib/cloudinary";
import { ReportWizard } from "./ReportWizard";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.report.title };
}

export default async function ReportPage() {
  const user = await getSessionUser();

  // Mandatory login. A complaint with no traceable source cannot be held to
  // any standard of authenticity, so intake starts at the sign-in page.
  if (!user) redirect("/login?next=/report");

  const { locale, t } = await getI18n();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <ReportWizard
          t={t}
          locale={locale}
          photoRequired={isPhotoStorageConfigured()}
          defaultPhone={user.phone ?? ""}
        />
      </main>
    </>
  );
}
