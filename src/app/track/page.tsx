import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, Eyebrow } from "@/components/ui";

export const metadata = { title: "Track a complaint" };

async function lookup(formData: FormData) {
  "use server";
  const raw = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!raw) return;
  const code = raw.startsWith("CP-") ? raw : `CP-${raw}`;
  redirect(`/track/${encodeURIComponent(code)}`);
}

export default function TrackLookupPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-16">
        <Eyebrow>Track</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-semibold">
          Where has my complaint got to?
        </h1>
        <p className="mt-2 text-ink-soft">
          Enter the ticket number you were given. You&rsquo;ll see its deadline,
          who holds it, and every escalation it has triggered.
        </p>

        <Card className="mt-6 p-5">
          <form action={lookup} className="space-y-3">
            <label className="block">
              <span className="eyebrow">Ticket number</span>
              <input
                name="code"
                required
                placeholder="CP-10432"
                className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-accent"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Look it up
            </button>
          </form>
        </Card>
      </main>
    </>
  );
}
