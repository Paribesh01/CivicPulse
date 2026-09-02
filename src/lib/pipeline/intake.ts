import "server-only";
import { prisma } from "@/lib/db";
import { notify, resolveEscalationRecipients } from "@/lib/notify";
import { award } from "@/lib/rewards";
import { classifyComplaint, type SupportedLocale } from "./classify";
import { findResponsibleOfficer, type Assignment } from "./assign";
import { resolveWard, type WardResolution } from "./location";
import { calculatePriority, calculateSlaHours } from "./priority";
import type {
  Classification,
  IntakeInput,
  IntakeTrace,
  PriorityBreakdown,
  RouteWithDepartment,
} from "./types";
import type { Priority, Ward } from "@/generated/prisma";

/// Below this the classifier's category is a guess, so the ticket still routes
/// (waiting is worse than routing imperfectly) but it is flagged for a human.
const REVIEW_CONFIDENCE_THRESHOLD = 0.55;

/// How far back to look for the same problem at the same place when scoring
/// repeat complaints.
const REPEAT_WINDOW_DAYS = 30;

export type PipelineResult = {
  classification: Classification;
  route: RouteWithDepartment | null;
  wardResolution: WardResolution;
  ward: Ward | null;
  priority: Priority;
  priorityBreakdown: PriorityBreakdown;
  slaHours: number;
  assignment: Assignment;
  repeatCount: number;
  needsReview: boolean;
};

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

/// Stages 2-6: classify, detect department, calculate priority, detect
/// location, and find the officer who would take it. Writes nothing, so the
/// guided intake wizard can show a citizen what will happen before they
/// commit — and so submission can re-run it authoritatively rather than
/// trusting whatever the browser sends back.
async function runPipeline(
  input: IntakeInput,
  locale: SupportedLocale,
): Promise<PipelineResult> {
  const [routes, wards, citizen] = await Promise.all([
    prisma.categoryRoute.findMany({
      where: { active: true },
      include: { department: true },
    }) as Promise<RouteWithDepartment[]>,
    prisma.ward.findMany(),
    input.citizenId
      ? prisma.user.findUnique({
          where: { id: input.citizenId },
          select: { id: true, wardId: true },
        })
      : Promise.resolve(null),
  ]);

  // 02 — AI classification
  const classification = await classifyComplaint(input.text, routes, locale);

  // 03 — Department detection
  const route = routes.find((r) => r.key === classification.categoryKey) ?? null;

  // 05 — Location detection (before priority: repeats are counted per ward)
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

  return {
    classification,
    route,
    wardResolution,
    ward: wardResolution.ward,
    priority,
    priorityBreakdown: { score, signals },
    slaHours,
    assignment,
    repeatCount,
    needsReview: classification.confidence < REVIEW_CONFIDENCE_THRESHOLD || !route,
  };
}

/// Read-only preview for the guided wizard. Nothing is persisted.
export async function analyzeComplaint(
  input: IntakeInput,
  locale: SupportedLocale = "en",
): Promise<PipelineResult> {
  return runPipeline(input, locale);
}

/// Stages 1-7. The pipeline is re-run here rather than trusting an analysis
/// echoed back by the browser — otherwise a crafted request could pick its own
/// priority, department or deadline.
export async function intakeComplaint(
  input: IntakeInput,
  locale: SupportedLocale = "en",
): Promise<{
  complaintId: string;
  code: string;
  trace: IntakeTrace;
  pointsAwarded: number;
}> {
  const result = await runPipeline(input, locale);
  const {
    classification,
    route,
    wardResolution,
    priority,
    priorityBreakdown,
    slaHours,
    assignment,
    needsReview,
  } = result;

  // 07 — Automatic assignment. The clock starts here, not at submission: an
  // officer cannot be held to a deadline that began before they had the job.
  const now = new Date();
  const assigned = assignment.assigneeId !== null;
  const dueAt = new Date(now.getTime() + slaHours * 3_600_000);
  const code = await nextTicketCode();

  const complaint = await prisma.$transaction(async (tx) => {
    const created = await tx.complaint.create({
      data: {
        code,
        rawText: input.text,
        language: classification.language,
        channel: input.channel ?? "WEB",
        photoUrl: input.photoUrl ?? null,
        photoPublicId: input.photoPublicId ?? null,
        citizenId: input.citizenId,
        citizenPhone: input.citizenPhone ?? null,

        categoryRouteId: route?.id ?? null,
        subCategory: classification.subCategory || null,
        intentSummary: classification.intentSummary,
        confidence: classification.confidence,
        needsReview,

        priority,
        priorityScore: priorityBreakdown.score,
        prioritySignals: priorityBreakdown.signals,
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
          message: `Complaint received via ${input.channel ?? "WEB"}${
            input.photoUrl ? " with photo evidence" : ""
          }`,
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
          message: `Priority ${priority} (score ${priorityBreakdown.score}/100)`,
          meta: { signals: priorityBreakdown.signals },
        },
        {
          complaintId: created.id,
          type: "LOCATED",
          message: wardResolution.ward
            ? `Resolved to ${wardResolution.ward.name}, ${wardResolution.ward.zone} via ${wardResolution.method}`
            : "Location could not be resolved to a ward",
          meta: {
            method: wardResolution.method,
            matchedOn: wardResolution.matchedOn,
          },
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

  // Reporting is what we want more of, so it pays immediately rather than
  // only on resolution.
  const pointsAwarded = await award({
    userId: input.citizenId,
    complaintId: complaint.id,
    reason: "COMPLAINT_FILED",
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

  recipients.push({
    userId: input.citizenId,
    complaintId: complaint.id,
    title: `Complaint ${code} registered`,
    body: assigned
      ? `Assigned to ${route?.department.name}. Expected resolution within ${slaHours} hours.`
      : `Received and awaiting assignment by ${route?.department.name ?? "the grievance cell"}.`,
    channel: input.citizenPhone ? "SMS" : "IN_APP",
  });

  await notify(recipients);

  return {
    complaintId: complaint.id,
    code,
    pointsAwarded,
    trace: {
      classification,
      route,
      ward: wardResolution.ward,
      priorityBreakdown,
      assigneeId: assignment.assigneeId,
      assignmentNote: assignment.note,
      slaHours,
      dueAt,
    },
  };
}
