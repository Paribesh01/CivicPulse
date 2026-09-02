import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { BigButton, Card } from "@/components/ui";
import { getI18n } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.track.title };
}

async function lookup(formData: FormData) {
  "use server";
  const raw = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!raw) return;
  const code = raw.startsWith("CP-") ? raw : `CP-${raw}`;
  redirect(`/track/${encodeURIComponent(code)}`);
}

export default async function TrackLookupPage() {
  const { t } = await getI18n();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
        <h1 className="font-serif text-3xl font-bold">{t.track.title}</h1>
        <p className="mt-2 text-ink-soft">{t.track.body}</p>

        <Card className="mt-5 p-5">
          <form action={lookup} className="space-y-4">
            <input
              name="code"
              required
              autoFocus
              placeholder={t.track.placeholder}
              className="w-full rounded-xl border-2 border-line bg-bg px-4 text-center font-mono text-2xl tracking-wider outline-none transition-colors focus:border-accent"
            />
            <BigButton type="submit" icon={<Search className="h-5 w-5" />}>
              {t.track.lookUp}
            </BigButton>
          </form>
        </Card>
      </main>
    </>
  );
}
