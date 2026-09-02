"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/dictionaries";

/// Switching language must work for signed-out visitors too, so the cookie is
/// the source of truth and the profile write is a best-effort follow-up for
/// signed-in users on their next device.
export async function setLocale(value: string): Promise<void> {
  if (!isLocale(value)) return;

  (await cookies()).set(LOCALE_COOKIE, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  const user = await getSessionUser();
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { locale: value },
    });
  }

  revalidatePath("/", "layout");
}
