import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { intakeComplaint } from "@/lib/pipeline/intake";
import { getSessionUser } from "@/lib/session";
import { getLocale } from "@/lib/i18n";
import { complaintScope } from "@/lib/scope";
import { isOwnPhotoUrl, isPhotoStorageConfigured } from "@/lib/cloudinary";

const CreateSchema = z.object({
  text: z.string().min(10).max(4000),
  locationHint: z.string().max(300).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  channel: z.enum(["WEB", "APP", "IVR", "SMS", "WALK_IN"]).optional(),
  photoUrl: z.string().url().max(2000).optional().nullable(),
  photoPublicId: z.string().max(300).optional().nullable(),
});

export async function POST(request: Request) {
  // Complaints are only registered for a signed-in citizen. Knowing the source
  // is what makes spam and fake reports answerable; the citizen's identity is
  // still kept off every public page.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in required to file a complaint" },
      { status: 401 },
    );
  }

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

  const { photoUrl } = parsed.data;

  // Photo evidence is mandatory wherever it can actually be stored. With no
  // image backend configured the app stays usable rather than blocking every
  // report on infrastructure that isn't wired up yet.
  if (isPhotoStorageConfigured()) {
    if (!photoUrl) {
      return NextResponse.json(
        { error: "A photo of the problem is required", field: "photoUrl" },
        { status: 400 },
      );
    }
    // Only accept URLs in our own Cloudinary folder — otherwise the field is
    // just an open redirect to any image on the internet.
    if (!isOwnPhotoUrl(photoUrl)) {
      return NextResponse.json(
        { error: "Photo must be uploaded through this app", field: "photoUrl" },
        { status: 400 },
      );
    }
  }

  try {
    const locale = await getLocale();
    const { complaintId, code, trace, pointsAwarded } = await intakeComplaint(
      {
        text: parsed.data.text,
        citizenId: user.id,
        citizenPhone: parsed.data.phone ?? user.phone ?? null,
        locationHint: parsed.data.locationHint,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        channel: parsed.data.channel ?? "WEB",
        photoUrl: photoUrl ?? null,
        photoPublicId: parsed.data.photoPublicId ?? null,
      },
      locale,
    );

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
        pointsAwarded,
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
      photoUrl: true,
      categoryRoute: { select: { label: true, group: true } },
      department: { select: { name: true, code: true } },
      ward: { select: { name: true, zone: true } },
      assignee: { select: { name: true } },
    },
  });

  return NextResponse.json({ complaints });
}
