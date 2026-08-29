import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { intakeComplaint } from "@/lib/pipeline/intake";
import { getSessionUser } from "@/lib/session";
import { complaintScope } from "@/lib/scope";

/// Intake endpoint. The brief's citizen app, web form and IVR bridge all land
/// here — `channel` is how they identify themselves.
const CreateSchema = z.object({
  text: z.string().min(10, "Describe the problem in at least 10 characters").max(4000),
  locationHint: z.string().max(300).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  channel: z.enum(["WEB", "APP", "IVR", "SMS", "WALK_IN"]).optional(),
  photoUrl: z.string().url().max(2000).optional().nullable(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid complaint", issues: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  // Anonymous submissions are allowed on purpose — requiring an account is
  // exactly the friction that keeps civic complaints from being filed.
  const user = await getSessionUser();

  try {
    const { complaintId, code, trace } = await intakeComplaint({
      text: parsed.data.text,
      citizenId: user?.id ?? null,
      citizenPhone: parsed.data.phone ?? user?.phone ?? null,
      locationHint: parsed.data.locationHint,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      channel: parsed.data.channel ?? "WEB",
      photoUrl: parsed.data.photoUrl,
    });

    return NextResponse.json(
      {
        id: complaintId,
        code,
        category: trace.route ? `${trace.route.group} › ${trace.route.label}` : null,
        department: trace.route?.department.name ?? null,
        priority: trace.priorityBreakdown.score,
        ward: trace.ward ? `${trace.ward.name}, ${trace.ward.zone}` : null,
        assigned: trace.assigneeId !== null,
        assignment: trace.assignmentNote,
        slaHours: trace.slaHours,
        dueAt: trace.dueAt,
        signals: trace.priorityBreakdown.signals,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/complaints]", error);
    return NextResponse.json({ error: "Could not register complaint" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const complaints = await prisma.complaint.findMany({
    where: {
      ...complaintScope(user),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: [{ priority: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      code: true,
      rawText: true,
      status: true,
      priority: true,
      priorityScore: true,
      dueAt: true,
      assignedAt: true,
      resolvedAt: true,
      createdAt: true,
      escalationLevel: true,
      categoryRoute: { select: { label: true, group: true } },
      department: { select: { name: true, code: true } },
      ward: { select: { name: true, zone: true } },
      assignee: { select: { name: true } },
    },
  });

  return NextResponse.json({ complaints });
}
