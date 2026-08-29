import "server-only";
import { prisma } from "@/lib/db";
import type { NotificationChannel, Prisma } from "@/generated/prisma";

export type NotificationDraft = {
  userId: string;
  complaintId?: string | null;
  title: string;
  body: string;
  channel?: NotificationChannel;
};

/// Notifications are rows first. SMS and push are the delivery layer the brief
/// calls for; until a gateway is wired in, dispatch is logged so the demo can
/// show what would have been sent to whom.
export async function notify(
  drafts: NotificationDraft[],
  tx?: Prisma.TransactionClient,
): Promise<void> {
  if (drafts.length === 0) return;

  const client = tx ?? prisma;
  await client.notification.createMany({
    data: drafts.map((d) => ({
      userId: d.userId,
      complaintId: d.complaintId ?? null,
      title: d.title,
      body: d.body,
      channel: d.channel ?? "IN_APP",
    })),
  });

  for (const draft of drafts) {
    if (draft.channel && draft.channel !== "IN_APP") {
      console.info(
        `[notify:${draft.channel}] -> user ${draft.userId}: ${draft.title}`,
      );
    }
  }
}

/// Everyone who should see a ticket at a given escalation rung: the assignee,
/// plus the named tier within the same department.
export async function resolveEscalationRecipients(args: {
  departmentId: string | null;
  role: "SUPERVISOR" | "DEPT_HEAD" | "ADMIN";
}): Promise<string[]> {
  const { departmentId, role } = args;

  const users = await prisma.user.findMany({
    where: {
      role,
      // Department heads and supervisors are department-scoped; admins are not.
      ...(role === "ADMIN" ? {} : { departmentId: departmentId ?? undefined }),
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}
