import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeComplaint } from "@/lib/pipeline/intake";
import { getSessionUser } from "@/lib/session";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const AnalyzeSchema = z.object({
  text: z.string().min(10).max(4000),
  locationHint: z.string().max(300).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
});

/// Powers the guided wizard: shows the citizen what the system understood —
/// department, area, urgency, deadline — and lets it ask one follow-up
/// question before anything is filed. Writes nothing.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const parsed = AnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please describe the problem" }, { status: 400 });
  }

  try {
    const locale = await getLocale();
    const result = await analyzeComplaint(
      {
        text: parsed.data.text,
        citizenId: user.id,
        locationHint: parsed.data.locationHint,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
      },
      locale,
    );

    const dueAt = new Date(Date.now() + result.slaHours * 3_600_000);

    return NextResponse.json({
      summary: result.classification.citizenSummary,
      question: result.classification.clarifyingQuestion,
      categoryKey: result.classification.categoryKey,
      category: result.route
        ? `${result.route.group} › ${result.route.label}`
        : null,
      categoryLabel: result.route?.label ?? null,
      department: result.route?.department.name ?? null,
      ward: result.ward ? `${result.ward.name}, ${result.ward.zone}` : null,
      locationResolved: result.ward !== null,
      priority: result.priority,
      priorityScore: result.priorityBreakdown.score,
      signals: result.priorityBreakdown.signals,
      slaHours: result.slaHours,
      dueAt,
      willAssign: result.assignment.assigneeId !== null,
      needsReview: result.needsReview,
    });
  } catch (error) {
    console.error("[POST /api/complaints/analyze]", error);
    return NextResponse.json({ error: "Could not read the complaint" }, { status: 500 });
  }
}
