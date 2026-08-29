import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role, User } from "@/generated/prisma";

/// Staff tiers in escalation order. Index is the rung: an officer's ticket
/// escalates to a supervisor, then to a department head.
export const ESCALATION_CHAIN: Role[] = ["OFFICER", "SUPERVISOR", "DEPT_HEAD"];

export const STAFF_ROLES: Role[] = [
  "OFFICER",
  "SUPERVISOR",
  "DEPT_HEAD",
  "ADMIN",
];

export function isStaff(role: Role | undefined | null): boolean {
  return !!role && STAFF_ROLES.includes(role);
}

/// Can see every department's tickets rather than just their own.
export function canSeeAllDepartments(role: Role): boolean {
  return role === "ADMIN" || role === "DEPT_HEAD";
}

/// Deduped per request so a page that checks the session in three places
/// still only hits the database once.
export const getSessionUser = cache(async (): Promise<User | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  // Re-read from the database rather than trusting the session copy: a role
  // or department change must take effect without waiting for the cookie
  // cache to expire.
  return prisma.user.findUnique({ where: { id: session.user.id } });
});

export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: Role[]): Promise<User> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function requireStaff(): Promise<User> {
  return requireRole(STAFF_ROLES);
}
