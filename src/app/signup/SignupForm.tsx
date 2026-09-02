"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert, UserPlus } from "lucide-react";
import { BigButton } from "@/components/ui";
import { signUp } from "@/lib/auth-client";
import { Field } from "@/app/login/LoginForm";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function SignupForm({ t, next }: { t: Dictionary; next: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      setError(t.auth.passwordHint);
      return;
    }

    setPending(true);
    setError(null);

    const { error: signUpError } = await signUp.email({
      name,
      email,
      password,
      phone: phone || undefined,
    });

    if (signUpError) {
      setError(signUpError.message ?? "Could not create the account");
      setPending(false);
      return;
    }

    router.push(next as never);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label={t.auth.name}
        value={name}
        onChange={setName}
        autoComplete="name"
        required
      />
      <Field
        label={t.auth.email}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Field
        label={`${t.auth.phone} (${t.common.optional})`}
        type="tel"
        value={phone}
        onChange={setPhone}
        autoComplete="tel"
        placeholder="+91 …"
      />
      <Field
        label={t.auth.password}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
        hint={t.auth.passwordHint}
      />

      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-critical-soft p-3 text-critical">
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          {error}
        </p>
      )}

      <BigButton
        type="submit"
        disabled={pending}
        icon={<UserPlus className="h-5 w-5" />}
      >
        {pending ? t.common.loading : t.common.signUp}
      </BigButton>
    </form>
  );
}
