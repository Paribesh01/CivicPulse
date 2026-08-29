import type { Prisma, User } from "@/generated/prisma";

/// Who is allowed to see which tickets. Every list and detail query goes
/// through this so a new surface cannot accidentally widen access.
export function complaintScope(user: User): Prisma.ComplaintWhereInput {
  switch (user.role) {
    case "ADMIN":
      return {};

    case "DEPT_HEAD":
    case "SUPERVISOR":
      // Department-wide, including tickets nobody could be assigned to —
      // those are exactly the ones a supervisor needs to see.
      return user.departmentId
        ? { departmentId: user.departmentId }
        : { id: "__no_department__" };

    case "OFFICER":
      return { assigneeId: user.id };

    case "CITIZEN":
    default:
      return { citizenId: user.id };
  }
}

export function canUpdateComplaint(user: User, complaint: { assigneeId: string | null; departmentId: string | null }): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "OFFICER") return complaint.assigneeId === user.id;
  if (user.role === "SUPERVISOR" || user.role === "DEPT_HEAD") {
    return !!user.departmentId && complaint.departmentId === user.departmentId;
  }
  return false;
}

/// Supervisors and above can hand a ticket to a different officer; the
/// officer holding it cannot pass it on themselves.
export function canReassign(user: User): boolean {
  return user.role === "ADMIN" || user.role === "SUPERVISOR" || user.role === "DEPT_HEAD";
}
