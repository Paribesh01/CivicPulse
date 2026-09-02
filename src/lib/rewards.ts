import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

/// Points exist to keep citizens reporting — and, just as importantly, to make
/// reporting *honestly* the thing that pays. Filing earns a little; a report
/// that turns out to be real and gets fixed earns most; a report rejected as
/// bogus costs more than filing it earned, so spam is net-negative.

export const POINT_RULES = {
  COMPLAINT_FILED: 10,
  COMPLAINT_RESOLVED: 25,
  COMPLAINT_CONFIRMED: 5,
  COMPLAINT_REJECTED: -20,
} as const;

export type PointReason = keyof typeof POINT_RULES;

export const TIERS = [
  { key: "NAGRIK", min: 0 },
  { key: "JAGRIK", min: 100 },
  { key: "PRAHARI", min: 300 },
  { key: "CHAMPION", min: 750 },
] as const;

export type TierKey = (typeof TIERS)[number]["key"];

export function tierFor(points: number): {
  key: TierKey;
  min: number;
  next: { key: TierKey; min: number } | null;
  toNext: number;
  progress: number;
} {
  let index = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (points >= TIERS[i].min) index = i;
  }

  const current = TIERS[index];
  const next = index + 1 < TIERS.length ? TIERS[index + 1] : null;
  const span = next ? next.min - current.min : 0;

  return {
    key: current.key,
    min: current.min,
    next: next ? { key: next.key, min: next.min } : null,
    toNext: next ? Math.max(0, next.min - points) : 0,
    progress: next && span > 0 ? Math.min(1, (points - current.min) / span) : 1,
  };
}

/// Grants points once per (user, complaint, reason). The unique constraint
/// makes this idempotent, so a ticket that is resolved, reopened and resolved
/// again cannot be farmed — and a retried request cannot double-pay.
export async function award(args: {
  userId: string;
  complaintId: string;
  reason: PointReason;
  tx?: Prisma.TransactionClient;
}): Promise<number> {
  const { userId, complaintId, reason } = args;
  const delta = POINT_RULES[reason];
  const client = args.tx ?? prisma;

  const existing = await client.pointsLedger.findFirst({
    where: { userId, complaintId, reason },
    select: { id: true },
  });
  if (existing) return 0;

  try {
    await client.pointsLedger.create({
      data: { userId, complaintId, reason, delta },
    });
  } catch {
    // Lost a race against a concurrent grant; the constraint held, which is
    // exactly what it is there for.
    return 0;
  }

  await client.user.update({
    where: { id: userId },
    data: { points: { increment: delta } },
  });

  return delta;
}

export async function getPointsSummary(userId: string) {
  const [user, history] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    }),
    prisma.pointsLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { complaint: { select: { code: true } } },
    }),
  ]);

  const points = user?.points ?? 0;
  return { points, tier: tierFor(points), history };
}
