"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert, LogIn } from "lucide-react";
import { BigButton } from "@/components/ui";
import { signIn } from "@/lib/auth-client";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function LoginForm({ t, next }: { t: Dictionary; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: signInError } = await signIn.email({ email, password });

    if (signInError) {
      setError(signInError.message ?? "Could not sign in");
      setPending(false);
      return;
    }

    router.push(next as never);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label={t.auth.email}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Field
        label={t.auth.password}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required
      />

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-critical-soft p-3 text-critical">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          {error}
        </p>
      )}

      <BigButton type="submit" disabled={pending} icon={<LogIn className="h-5 w-5" />}>
        {pending ? t.common.loading : t.common.signIn}
      </BigButton>
    </form>
  );
}

export function Field({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  required,
  placeholder,
  hint,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border-2 border-line bg-bg px-4 text-lg outline-none transition-colors focus:border-accent"
      />
      {hint && <span className="mt-1 block text-sm text-ink-soft">{hint}</span>}
    </label>
  );
}
