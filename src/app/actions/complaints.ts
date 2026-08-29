"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { requireUser } from "@/lib/session";
import { canReassign, canUpdateComplaint } from "@/lib/scope";
import type { ComplaintStatus } from "@/generated/prisma";

export type ActionResult = { ok: true } | { ok: false; error: string };

/// Which transitions are legal from each state. Keeping this explicit stops a
/// resolved ticket from quietly going back to "assigned" and restarting a
/// clock it already answered to.
const ALLOWED_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  SUBMITTED: ["TRIAGED", "ASSIGNED", "REJECTED", "DUPLICATE"],
  TRIAGED: ["ASSIGNED", "REJECTED", "DUPLICATE"],
  ASSIGNED: ["IN_PROGRESS", "RESOLVED", "REJECTED", "DUPLICATE"],
  IN_PROGRESS: ["RESOLVED", "REJECTED", "DUPLICATE"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  CLOSED: ["IN_PROGRESS"],
  REJECTED: ["TRIAGED"],
  DUPLICATE: ["TRIAGED"],
};

const UpdateSchema = z.object({
  complaintId: z.string().min(1),
  status: z.enum([
    "TRIAGED",
    "ASSIGNED",
    "IN_PROGRESS",
    "RESOLVED",
    "CLOSED",
    "REJECTED",
  ]),
  note: z.string().max(2000).optional(),
});

export async function updateComplaintStatus(
  input: z.infer<typeof UpdateSchema>,
): Promise<ActionResult> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const user = await requireUser();
  const { complaintId, status, note } = parsed.data;

  const complaint = await prisma.complaint.findUnique({
    where: { id: complaintId },
    select: {
      id: true,
      code: true,
      status: true,
      assigneeId: true,
      departmentId: true,
      citizenId: true,
      firstResponseAt: true,
    },
  });
  if (!complaint) return { ok: false, error: "Complaint not found" };

  // A citizen may close their own resolved ticket, and reopen it if the fix
  // did not hold. Everything else is staff-only.
  const citizenClosing =
    complaint.citizenId === user.id &&
    complaint.status === "RESOLVED" &&
    (status === "CLOSED" || status === "IN_PROGRESS");

  if (!citizenClosing && !canUpdateComplaint(user, complaint)) {
    return { ok: false, error: "You do not have access to this complaint" };
  }

  if (!ALLOWED_TRANSITIONS[complaint.status].includes(status)) {
    return {
      ok: false,
      error: `Cannot move a ${complaint.status.toLowerCase()} ticket to ${status.toLowerCase()}`,
    };
  }

  if (status === "RESOLVED" && !note?.trim()) {
    return { ok: false, error: "A resolution note is required" };
  }

  const now = new Date();
  const reopening = status === "IN_PROGRESS" && complaint.status !== "ASSIGNED";

  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: complaint.id },
      data: {
        status,
        // First touch is what "responsiveness" is actually measured on.
        firstResponseAt: complaint.firstResponseAt ?? now,
        ...(status === "RESOLVED"
          ? { resolvedAt: now, resolutionNote: note?.trim() }
          : {}),
        ...(reopening ? { resolvedAt: null, resolutionNote: null } : {}),
      },
    });

    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        type:
          status === "RESOLVED"
            ? "RESOLVED"
            : reopening
              ? "REOPENED"
              : "STATUS_CHANGED",
        message:
          status === "RESOLVED"
            ? `Marked resolved: ${note!.trim()}`
            : reopening
              ? `Reopened${note?.trim() ? `: ${note.trim()}` : ""}`
              : `Status changed to ${status.toLowerCase().replace("_", " ")}`,
        actorId: user.id,
      },
    });
  });

  if (complaint.citizenId && (status === "RESOLVED" || reopening)) {
    await notify([
      {
        userId: complaint.citizenId,
        complaintId: complaint.id,
        title: `${complaint.code} ${status === "RESOLVED" ? "resolved" : "reopened"}`,
        body:
          status === "RESOLVED"
            ? `${note!.trim()} — tell us if the problem is still there.`
            : "Your complaint has been reopened.",
        channel: "SMS",
      },
    ]);
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/complaints/${complaint.id}`);
  revalidatePath(`/track/${complaint.code}`);
  return { ok: true };
}

const ReassignSchema = z.object({
  complaintId: z.string().min(1),
  assigneeId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function reassignComplaint(
  input: z.infer<typeof ReassignSchema>,
): Promise<ActionResult> {
  const parsed = ReassignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const user = await requireUser();
  if (!canReassign(user)) {
    return { ok: false, error: "Only supervisors can reassign tickets" };
  }

  const { complaintId, assigneeId, reason } = parsed.data;

  const [complaint, assignee] = await Promise.all([
    prisma.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        code: true,
        status: true,
        assigneeId: true,
        departmentId: true,
        slaHours: true,
        assignedAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, name: true, departmentId: true, role: true },
    }),
  ]);

  if (!complaint) return { ok: false, error: "Complaint not found" };
  if (!assignee || assignee.role !== "OFFICER") {
    return { ok: false, error: "Pick an officer to assign to" };
  }
  if (!canUpdateComplaint(user, complaint)) {
    return { ok: false, error: "You do not have access to this complaint" };
  }
  if (assignee.departmentId !== complaint.departmentId) {
    return { ok: false, error: "That officer is in a different department" };
  }

  const now = new Date();
  // A ticket that was never assigned starts its clock now. One being handed
  // over keeps its original deadline — reassignment must not buy more time.
  const startsClock = complaint.assignedAt === null;
  const slaHours = complaint.slaHours ?? 48;

  await prisma.$transaction(async (tx) => {
    await tx.complaint.update({
      where: { id: complaint.id },
      data: {
        assigneeId: assignee.id,
        status: complaint.status === "TRIAGED" ? "ASSIGNED" : complaint.status,
        ...(startsClock
          ? {
              assignedAt: now,
              dueAt: new Date(now.getTime() + slaHours * 3_600_000),
            }
          : {}),
      },
    });

    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        type: complaint.assigneeId ? "REASSIGNED" : "ASSIGNED",
        message: `${complaint.assigneeId ? "Reassigned" : "Assigned"} to ${assignee.name}${
          reason?.trim() ? ` — ${reason.trim()}` : ""
        }`,
        actorId: user.id,
      },
    });
  });

  await notify([
    {
      userId: assignee.id,
      complaintId: complaint.id,
      title: `${complaint.code} assigned to you`,
      body: reason?.trim() || "Assigned by your supervisor.",
      channel: "PUSH",
    },
  ]);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/complaints/${complaint.id}`);
  return { ok: true };
}

const CommentSchema = z.object({
  complaintId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export async function addComplaintComment(
  input: z.infer<typeof CommentSchema>,
): Promise<ActionResult> {
  const parsed = CommentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write something first" };

  const user = await requireUser();
  const complaint = await prisma.complaint.findUnique({
    where: { id: parsed.data.complaintId },
    select: { id: true, code: true, assigneeId: true, departmentId: true, citizenId: true },
  });
  if (!complaint) return { ok: false, error: "Complaint not found" };

  const isOwner = complaint.citizenId === user.id;
  if (!isOwner && !canUpdateComplaint(user, complaint)) {
    return { ok: false, error: "You do not have access to this complaint" };
  }

  await prisma.complaintEvent.create({
    data: {
      complaintId: complaint.id,
      type: "COMMENT",
      message: parsed.data.body.trim(),
      actorId: user.id,
    },
  });

  revalidatePath(`/dashboard/complaints/${complaint.id}`);
  revalidatePath(`/track/${complaint.code}`);
  return { ok: true };
}
