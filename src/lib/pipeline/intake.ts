import "server-only";
import { prisma } from "@/lib/db";
import { notify, resolveEscalationRecipients } from "@/lib/notify";
import { classifyComplaint } from "./classify";
import { findResponsibleOfficer } from "./assign";
import { resolveWard } from "./location";
import { calculatePriority, calculateSlaHours } from "./priority";
import type { IntakeInput, IntakeTrace, RouteWithDepartment } from "./types";

/// Below this the classifier's category is a guess, so the ticket still routes
/// (waiting is worse than routing imperfectly) but it is flagged for a human.
const REVIEW_CONFIDENCE_THRESHOLD = 0.55;

/// How far back to look for the same problem at the same place when scoring
/// repeat complaints.
const REPEAT_WINDOW_DAYS = 30;

/// Human-facing ticket number. A dedicated counter row keeps these sequential
/// and dense, which cuid()s are not.
async function nextTicketCode(): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { name: "complaint" },
    create: { name: "complaint", value: 10001 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return `CP-${counter.value}`;
}

/// Runs stages 1-7 of the pipeline: classify, detect department, calculate
/// priority, detect location, find the nearest officer, assign, and start the
/// SLA clock. Stage 8 (monitoring) is the sweep in src/lib/sla.ts.
export async function intakeComplaint(
  input: IntakeInput,
): Promise<{ complaintId: string; code: string; trace: IntakeTrace }> {
  const [routes, wards, citizen] = await Promise.all([
    prisma.categoryRoute.findMany({
      where: { active: true },
      include: { department: true },
    }) as Promise<RouteWithDepartment[]>,
    prisma.ward.findMany(),
    input.citizenId
      ? prisma.user.findUnique({
          where: { id: input.citizenId },
          select: { id: true, wardId: true, name: true },
        })
      : Promise.resolve(null),
  ]);

  // 02 — AI classification
  const classification = await classifyComplaint(input.text, routes);

  // 03 — Department detection
  const route = routes.find((r) => r.key === classification.categoryKey) ?? null;

  // 05 — Location detection (needed before priority, since repeats are
  // counted per ward)
  const wardResolution = resolveWard({
    wards,
    text: input.text,
    locationHint: input.locationHint ?? classification.locationText,
    lat: input.lat,
    lng: input.lng,
    citizenWardId: citizen?.wardId ?? null,
  });

  const repeatCount =
    route && wardResolution.ward
      ? await prisma.complaint.count({
          where: {
            categoryRouteId: route.id,
            wardId: wardResolution.ward.id,
            status: { notIn: ["RESOLVED", "CLOSED", "REJECTED", "DUPLICATE"] },
            createdAt: {
              gte: new Date(Date.now() - REPEAT_WINDOW_DAYS * 86_400_000),
            },
          },
        })
      : 0;

  // 04 — Priority calculation
  const { score, signals, priority } = calculatePriority(
    classification,
    route,
    repeatCount,
  );
  const slaHours = calculateSlaHours(route, priority);

  // 06 — Nearest responsible officer
  const assignment = await findResponsibleOfficer({
    departmentId: route?.departmentId ?? null,
    ward: wardResolution.ward,
  });

  // 07 — Automatic assignment. The clock starts here, not at submission: an
  // officer cannot be held to a deadline that began before they had the job.
  const now = new Date();
  const assigned = assignment.assigneeId !== null;
  const dueAt = new Date(now.getTime() + slaHours * 3_600_000);
  const code = await nextTicketCode();

  const needsReview =
    classification.confidence < REVIEW_CONFIDENCE_THRESHOLD || !route;

  const complaint = await prisma.$transaction(async (tx) => {
    const created = await tx.complaint.create({
      data: {
        code,
        rawText: input.text,
        language: classification.language,
        channel: input.channel ?? "WEB",
        photoUrl: input.photoUrl ?? null,
        citizenId: citizen?.id ?? null,
        citizenPhone: input.citizenPhone ?? null,

        categoryRouteId: route?.id ?? null,
        subCategory: classification.subCategory || null,
        intentSummary: classification.intentSummary,
        confidence: classification.confidence,
        needsReview,

        priority,
        priorityScore: score,
        prioritySignals: signals,
        reportedDurationDays: classification.reportedDurationDays,

        locationText: input.locationHint ?? classification.locationText,
        wardId: wardResolution.ward?.id ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,

        departmentId: route?.departmentId ?? null,
        assigneeId: assignment.assigneeId,
        status: assigned ? "ASSIGNED" : "TRIAGED",
        slaHours,
        assignedAt: assigned ? now : null,
        dueAt: assigned ? dueAt : null,
      },
    });

    await tx.complaintEvent.createMany({
      data: [
        {
          complaintId: created.id,
          type: "SUBMITTED",
          message: `Complaint received via ${input.channel ?? "WEB"}`,
        },
        {
          complaintId: created.id,
          type: "CLASSIFIED",
          message: route
            ? `Classified as ${route.group} › ${route.label}${
                classification.subCategory ? ` (${classification.subCategory})` : ""
              }`
            : "Could not be classified against the taxonomy",
          meta: {
            confidence: classification.confidence,
            source: classification.source,
            hazardSignals: classification.hazardSignals,
          },
        },
        {
          complaintId: created.id,
          type: "ROUTED",
          message: route
            ? `Routed to ${route.department.name}`
            : "No department could be determined",
        },
        {
          complaintId: created.id,
          type: "PRIORITIZED",
          message: `Priority ${priority} (score ${score}/100)`,
          meta: { signals },
        },
        {
          complaintId: created.id,
          type: "LOCATED",
          message: wardResolution.ward
            ? `Resolved to ${wardResolution.ward.name}, ${wardResolution.ward.zone} via ${wardResolution.method}`
            : "Location could not be resolved to a ward",
          meta: { method: wardResolution.method, matchedOn: wardResolution.matchedOn },
        },
        {
          complaintId: created.id,
          type: assigned ? "ASSIGNED" : "TRIAGE_FAILED",
          message: assigned
            ? `Assigned to ${assignment.note}. ${slaHours}h SLA — due ${dueAt.toISOString()}`
            : assignment.note,
        },
      ],
    });

    return created;
  });

  // Notifications sit outside the transaction: a delivery hiccup must not roll
  // back a ticket that was legitimately created.
  const recipients: Parameters<typeof notify>[0] = [];

  if (assignment.assigneeId) {
    recipients.push({
      userId: assignment.assigneeId,
      complaintId: complaint.id,
      title: `New ${priority.toLowerCase()} ticket ${code}`,
      body: `${route?.label ?? "Uncategorised"}${
        wardResolution.ward ? ` in ${wardResolution.ward.name}` : ""
      }. Due in ${slaHours}h.`,
      channel: "PUSH",
    });
  } else {
    // Nobody to assign — make sure it lands in front of a supervisor rather
    // than sitting in a queue no one watches.
    const supervisors = await resolveEscalationRecipients({
      departmentId: route?.departmentId ?? null,
      role: "SUPERVISOR",
    });
    for (const userId of supervisors) {
      recipients.push({
        userId,
        complaintId: complaint.id,
        title: `${code} needs manual assignment`,
        body: assignment.note,
      });
    }
  }

  if (citizen?.id) {
    recipients.push({
      userId: citizen.id,
      complaintId: complaint.id,
      title: `Complaint ${code} registered`,
      body: assigned
        ? `Assigned to ${route?.department.name}. Expected resolution within ${slaHours} hours.`
        : `Received and awaiting assignment by ${route?.department.name ?? "the grievance cell"}.`,
      channel: input.citizenPhone ? "SMS" : "IN_APP",
    });
  }

  await notify(recipients);

  return {
    complaintId: complaint.id,
    code,
    trace: {
      classification,
      route,
      ward: wardResolution.ward,
      priorityBreakdown: { score, signals },
      assigneeId: assignment.assigneeId,
      assignmentNote: assignment.note,
      slaHours,
      dueAt,
    },
  };
}
