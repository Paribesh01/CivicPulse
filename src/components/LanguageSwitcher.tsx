"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/dictionaries";

/// A visible two-option toggle rather than a dropdown: the language control is
/// the first thing a Hindi-speaking user needs, and it should be readable and
/// tappable without opening anything.
export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="flex items-center gap-1 rounded-full border-2 border-line bg-surface p-1"
      role="group"
      aria-label="Language"
    >
      <Languages className="ml-1.5 h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
      {LOCALES.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            disabled={pending}
            aria-pressed={active}
            onClick={() => {
              if (active) return;
              startTransition(async () => {
                await setLocale(locale);
                router.refresh();
              });
            }}
            className={`min-h-9 rounded-full px-3 text-sm font-medium transition-colors disabled:opacity-60 ${
              active
                ? "bg-accent text-white"
                : "text-ink-soft hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {LOCALE_LABELS[locale]}
          </button>
        );
      })}
    </div>
  );
}
