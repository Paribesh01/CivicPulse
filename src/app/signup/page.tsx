import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Card, Eyebrow } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create an account" };

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-14">
        <Eyebrow>Create an account</Eyebrow>
        <h1 className="mt-3 font-serif text-3xl font-semibold">
          Track what you report
        </h1>
        <p className="mt-2 text-ink-soft">
          An account lets you follow a complaint&rsquo;s deadline, see who it
          was assigned to, and reopen it if the fix doesn&rsquo;t hold.
        </p>

        <Card className="mt-6 p-5">
          <SignupForm />
          <p className="mt-4 text-sm text-ink-soft">
            Already registered?{" "}
            <Link href="/login" className="text-accent underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </Card>

        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Signing up creates a citizen account. Officer, supervisor and
          department-head access is granted by an administrator &mdash; it
          can&rsquo;t be claimed from this form.
        </p>
      </main>
    </>
  );
}
