import "server-only";
import { prisma } from "@/lib/db";
import { notify, type NotificationDraft } from "@/lib/notify";
import type { EscalationRule, EventType, Role } from "@/generated/prisma";

/// Stage 8 of the pipeline. One sweep over every open ticket rather than a
/// timer per ticket: the brief's own recommendation, and it means a restarted
/// or briefly-down worker catches up instead of losing deadlines.

export type SweepResult = {
  checked: number;
  fired: {
    code: string;
    rule: string;
    kind: string;
    escalatedTo: Role | null;
  }[];
};

const EVENT_FOR_KIND: Record<string, EventType> = {
  REMINDER: "REMINDER",
  WARNING: "WARNING",
  ESCALATE: "ESCALATED",
};

/// Department-specific rules override the global ladder wholesale — a
/// department that defines its own rungs gets exactly those, not a merge.
function rulesFor(
  all: EscalationRule[],
  departmentId: string | null,
): EscalationRule[] {
  const specific = all.filter((r) => r.departmentId === departmentId);
  const chosen = specific.length > 0 ? specific : all.filter((r) => r.departmentId === null);
  return [...chosen].sort((a, b) => a.sequence - b.sequence);
}

export async function runSlaSweep(now: Date = new Date()): Promise<SweepResult> {
  const [open, allRules] = await Promise.all([
    prisma.complaint.findMany({
      where: {
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        dueAt: { not: null },
        assignedAt: { not: null },
      },
      select: {
        id: true,
        code: true,
        departmentId: true,
        assigneeId: true,
        citizenId: true,
        assignedAt: true,
        dueAt: true,
        lastRuleFired: true,
        escalationLevel: true,
        priority: true,
        categoryRoute: { select: { label: true } },
      },
    }),
    prisma.escalationRule.findMany(),
  ]);

  const fired: SweepResult["fired"] = [];

  // Escalation targets are a property of (role, department), not of the
  // ticket — looking them up per rule per complaint turned the sweep into
  // hundreds of sequential round-trips against a remote database.
  const recipientCache = new Map<string, string[]>();
  async function recipientsFor(
    role: Role,
    departmentId: string | null,
  ): Promise<string[]> {
    const key = `${role}:${departmentId ?? "*"}`;
    const cached = recipientCache.get(key);
    if (cached) return cached;

    const users = await prisma.user.findMany({
      where: {
        role,
        ...(role === "ADMIN" ? {} : { departmentId: departmentId ?? undefined }),
      },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    recipientCache.set(key, ids);
    return ids;
  }

  for (const complaint of open) {
    const assignedAt = complaint.assignedAt!.getTime();
    const dueAt = complaint.dueAt!.getTime();
    const total = dueAt - assignedAt;
    if (total <= 0) continue;

    const fraction = (now.getTime() - assignedAt) / total;

    // Every rung that is now due and has not fired yet, in order. Firing them
    // all catches up a ticket whose deadlines passed while the sweep was down.
    const due = rulesFor(allRules, complaint.departmentId).filter(
      (rule) => rule.fraction <= fraction && rule.sequence > complaint.lastRuleFired,
    );
    if (due.length === 0) continue;

    for (const rule of due) {
      const drafts: NotificationDraft[] = [];
      const ticketLabel = complaint.categoryRoute?.label ?? "Complaint";

      if (rule.notifyAssignee && complaint.assigneeId) {
        drafts.push({
          userId: complaint.assigneeId,
          complaintId: complaint.id,
          title: `${complaint.code}: ${rule.label}`,
          body:
            rule.kind === "ESCALATE"
              ? `SLA breached on ${ticketLabel}. This has been escalated above you.`
              : `${ticketLabel} is ${Math.round(fraction * 100)}% through its SLA.`,
          channel: rule.kind === "REMINDER" ? "IN_APP" : "PUSH",
        });
      }

      if (rule.notifyRole) {
        const seniors = await recipientsFor(rule.notifyRole, complaint.departmentId);
        for (const seniorId of seniors) {
          drafts.push({
            userId: seniorId,
            complaintId: complaint.id,
            title: `${complaint.code} escalated — ${rule.label}`,
            body: `${complaint.priority} ${ticketLabel} is past its deadline and still open.`,
            channel: "PUSH",
          });
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.complaintEvent.create({
          data: {
            complaintId: complaint.id,
            type: EVENT_FOR_KIND[rule.kind] ?? "REMINDER",
            message:
              rule.kind === "ESCALATE"
                ? `${rule.label} — visibility raised to ${rule.notifyRole ?? "supervisor"}`
                : rule.label,
            meta: {
              rule: rule.sequence,
              fraction: Number(fraction.toFixed(3)),
              kind: rule.kind,
            },
          },
        });

        await tx.complaint.update({
          where: { id: complaint.id },
          data: {
            lastRuleFired: rule.sequence,
            ...(rule.kind === "ESCALATE"
              ? {
                  escalationLevel: { increment: 1 },
                  lastEscalatedAt: now,
                }
              : {}),
          },
        });

        await notify(drafts, tx);
      });

      fired.push({
        code: complaint.code,
        rule: rule.label,
        kind: rule.kind,
        escalatedTo: rule.notifyRole,
      });
    }
  }

  return { checked: open.length, fired };
}
