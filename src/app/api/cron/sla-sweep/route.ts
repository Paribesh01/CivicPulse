import { NextResponse } from "next/server";
import { runSlaSweep } from "@/lib/sla";

// The sweep both reads and writes, so it must never be cached or prerendered.
export const dynamic = "force-dynamic";

/// Stage 8. Point a cron at this every few minutes:
///   */5 * * * * curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
///     https://<host>/api/cron/sla-sweep
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Refusing is the safe default: an unauthenticated endpoint that fires
    // notifications is worse than a sweep that does not run.
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSlaSweep();
    return NextResponse.json({
      ok: true,
      checked: result.checked,
      firedCount: result.fired.length,
      fired: result.fired,
      sweptAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[sla-sweep]", error);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}

export const POST = handle;
// GET is accepted too so platform schedulers that only issue GETs work.
export const GET = handle;
