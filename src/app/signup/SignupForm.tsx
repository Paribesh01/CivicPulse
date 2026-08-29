"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { Field } from "@/app/login/LoginForm";

export function SignupForm() {
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
      setError("Password must be at least 8 characters");
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

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Full name" value={name} onChange={setName} autoComplete="name" required />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Field
        label="Mobile (optional)"
        type="tel"
        value={phone}
        onChange={setPhone}
        autoComplete="tel"
        placeholder="+91 …"
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
      />
      <p className="text-xs text-ink-faint">At least 8 characters.</p>

      {error && (
        <p className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
