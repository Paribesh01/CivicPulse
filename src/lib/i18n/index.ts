import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getSessionUser } from "@/lib/session";
import {
  DEFAULT_LOCALE,
  dictionaries,
  isLocale,
  type Dictionary,
  type Locale,
} from "./dictionaries";

export const LOCALE_COOKIE = "civicpulse_locale";

/// Locale resolution, most specific first: an explicit cookie beats the
/// signed-in user's saved preference, which beats the default. The cookie
/// wins so a language switch takes effect immediately, before the profile
/// write has landed.
export const getLocale = cache(async (): Promise<Locale> => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;

  const user = await getSessionUser();
  if (isLocale(user?.locale)) return user.locale;

  return DEFAULT_LOCALE;
});

export const getDictionary = cache(async (): Promise<Dictionary> => {
  return dictionaries[await getLocale()];
});

/// Both at once, for the common case where a page needs the dictionary and
/// also has to pass the active locale down to a client component.
export async function getI18n(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale] };
}

export { DEFAULT_LOCALE, dictionaries, isLocale };
export type { Dictionary, Locale };
