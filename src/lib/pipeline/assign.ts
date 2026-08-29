import "server-only";
import { prisma } from "@/lib/db";
import type { Ward } from "@/generated/prisma";

export type Assignment = {
  assigneeId: string | null;
  note: string;
};

/// Picks the officer actually on the hook: right department first, then as
/// close to the complaint as the roster allows, then whoever is carrying the
/// lightest load. Critical tickets count double because an officer holding
/// three criticals is busier than one holding three routine jobs.
export async function findResponsibleOfficer(args: {
  departmentId: string | null;
  ward: Ward | null;
}): Promise<Assignment> {
  const { departmentId, ward } = args;

  if (!departmentId) {
    return { assigneeId: null, note: "No department resolved — held for triage" };
  }

  const candidates = await prisma.user.findMany({
    where: { role: "OFFICER", departmentId, available: true },
    select: {
      id: true,
      name: true,
      wardId: true,
      ward: { select: { zone: true } },
      assignedComplaints: {
        where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        select: { priority: true },
      },
    },
  });

  if (candidates.length === 0) {
    return {
      assigneeId: null,
      note: "No available officer in this department — escalated to supervisor queue",
    };
  }

  const scored = candidates.map((officer) => {
    const openCount = officer.assignedComplaints.length;
    const criticalCount = officer.assignedComplaints.filter(
      (c) => c.priority === "CRITICAL",
    ).length;

    // Lower is better.
    const proximity =
      ward && officer.wardId === ward.id
        ? 0
        : ward && officer.ward?.zone === ward.zone
          ? 1
          : 2;

    return {
      officer,
      proximity,
      load: openCount + criticalCount,
      openCount,
    };
  });

  scored.sort(
    (a, b) => a.proximity - b.proximity || a.load - b.load || a.openCount - b.openCount,
  );

  const winner = scored[0];
  const proximityLabel =
    winner.proximity === 0
      ? `same ward (${ward?.name})`
      : winner.proximity === 1
        ? `same zone (${ward?.zone})`
        : "department-wide";

  return {
    assigneeId: winner.officer.id,
    note: `${winner.officer.name} — ${proximityLabel}, ${winner.openCount} open ticket${
      winner.openCount === 1 ? "" : "s"
    }`,
  };
}
