"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      title={label}
      aria-label={label}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.push("/");
        router.refresh();
      }}
      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-2.5 text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      <LogOut className="h-5 w-5" />
      <span className="sr-only sm:not-sr-only sm:text-sm">{label}</span>
    </button>
  );
}
