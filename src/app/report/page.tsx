import { SiteHeader } from "@/components/SiteHeader";
import { Eyebrow } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { ReportForm } from "./ReportForm";

export const metadata = { title: "Report an issue" };
export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const user = await getSessionUser();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12">
        <Eyebrow>Report an issue</Eyebrow>
        <h1 className="mt-3 max-w-2xl font-serif text-3xl font-semibold leading-tight">
          Describe the problem in your own words
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          No dropdowns, no category codes. Write it the way you would say it
          &mdash; in English, Hindi or a mix. CivicPulse works out the rest and
          shows you exactly what it decided.
        </p>

        <div className="mt-8">
          <ReportForm
            signedIn={!!user}
            defaultPhone={user?.phone ?? ""}
            citizenName={user?.name ?? null}
          />
        </div>
      </main>
    </>
  );
}
