import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

/// Populates a demo dataset against a *running* server: complaints go in
/// through the real HTTP intake so they exercise the whole pipeline, then a
/// selection is backdated so the escalation ladder has something to climb,
/// and finally the real sweep endpoint is called.
///
///   pnpm demo                      # against http://localhost:3000
///   BASE_URL=http://localhost:3003 pnpm demo

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET ?? "";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const COMPLAINTS: { text: string; locationHint?: string; channel?: string }[] = [
  { text: "Streetlight near XYZ school has not been working for 5 days.", channel: "WEB" },
  { text: "Open manhole near the Bus Stand with no cover for a week, someone is going to fall in at night.", channel: "APP" },
  { text: "Sewage is overflowing onto the road at Shastri Nagar and children walk through it on the way to school.", channel: "IVR" },
  { text: "Model Town mein 3 din se paani nahi aa raha hai.", channel: "SMS" },
  { text: "Garbage has not been collected in Gandhi Nagar for four days and it is starting to smell badly.", channel: "WEB" },
  { text: "Huge pothole on the main road in Civil Lines, two scooters have already fallen.", channel: "APP" },
  { text: "Live electric wire hanging low near Central Market, sparking when it rains.", channel: "IVR" },
  { text: "Traffic signal at Ghanta Ghar crossing has not been working since yesterday morning.", channel: "WEB" },
  { text: "Water is leaking continuously from a pipeline near Indira Nagar for the last 10 days.", channel: "WEB" },
  { text: "Tree has fallen across the road in Green Park after last night's storm, blocking traffic completely.", channel: "APP" },
  { text: "Mosquito breeding in stagnant water near District Hospital, several dengue cases in the colony.", channel: "WEB" },
  { text: "Public toilet at Rail Bazaar has been locked and filthy for two weeks.", channel: "WEB" },
  { text: "Drain is completely blocked in Sector 9 and water is entering our houses.", channel: "IVR" },
  { text: "Street lamp flickering all night on Panki Road, has been like this for 12 days.", channel: "WEB" },
  { text: "Stray cattle sitting in the middle of Kalyanpur main road causing accidents.", channel: "APP" },
];

/// Complaints now require a signed-in citizen, so the script authenticates the
/// same way a browser would and reuses the session cookie.
const DEMO_CITIZEN = { email: "ravi@example.com", password: "civicpulse123" };

async function signIn(): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    // Node's fetch sends a null Origin, which better-auth's CSRF check
    // rejects. Send the real one, exactly as a browser would.
    headers: { "Content-Type": "application/json", origin: BASE_URL },
    body: JSON.stringify(DEMO_CITIZEN),
  });

  if (!response.ok) {
    throw new Error(
      `Could not sign in as ${DEMO_CITIZEN.email} (${response.status}). ` +
        "Run `pnpm db:seed` first.",
    );
  }

  const cookies = response.headers.getSetCookie();
  if (cookies.length === 0) throw new Error("Sign-in returned no session cookie");
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

async function submit(complaint: (typeof COMPLAINTS)[number], cookie: string) {
  const response = await fetch(`${BASE_URL}/api/complaints`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie, origin: BASE_URL },
    body: JSON.stringify({
      text: complaint.text,
      locationHint: complaint.locationHint ?? null,
      channel: complaint.channel ?? "WEB",
    }),
  });

  if (!response.ok) {
    throw new Error(`Intake failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  const cookie = await signIn();
  console.log(`Signed in as ${DEMO_CITIZEN.email}`);
  console.log(`Submitting ${COMPLAINTS.length} complaints to ${BASE_URL}…\n`);

  for (const complaint of COMPLAINTS) {
    const result = await submit(complaint, cookie);
    console.log(
      `  ${result.code}  ${String(result.priority).padStart(3)}  ` +
        `${(result.department ?? "unrouted").padEnd(34)} ${result.ward ?? "—"}`,
    );
  }

  // Backdate a spread of tickets so the ladder has rungs to fire. Ages are
  // expressed as a fraction of each ticket's own SLA, matching how the sweep
  // actually reasons about them.
  const open = await prisma.complaint.findMany({
    where: { status: "ASSIGNED", assignedAt: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, code: true, slaHours: true },
  });

  const AGES = [0.6, 0.9, 1.2, 1.7, 0.4, 2.2, 0.95];
  const now = Date.now();
  let backdated = 0;

  for (const [i, complaint] of open.entries()) {
    const fraction = AGES[i % AGES.length];
    if (i >= AGES.length) break;

    const slaMs = (complaint.slaHours ?? 48) * 3_600_000;
    const assignedAt = new Date(now - slaMs * fraction);

    await prisma.complaint.update({
      where: { id: complaint.id },
      data: {
        assignedAt,
        dueAt: new Date(assignedAt.getTime() + slaMs),
        createdAt: assignedAt,
      },
    });
    backdated++;
  }

  console.log(`\nBackdated ${backdated} tickets so their clocks are partly spent.`);

  // Close out some of the backdated tickets so the accountability tables have
  // both outcomes in them. Resolving them "now" means whether each one met its
  // SLA falls out of how far its clock had already run — no faked verdicts.
  const resolvable = await prisma.complaint.findMany({
    where: {
      status: "ASSIGNED",
      assignedAt: { not: null, lt: new Date(now - 3_600_000) },
      dueAt: { not: null },
    },
    orderBy: { assignedAt: "asc" },
    take: 5,
    select: { id: true, code: true, assignedAt: true, dueAt: true },
  });

  let met = 0;
  let missed = 0;

  for (const complaint of resolvable) {
    const resolvedAt = new Date(now);
    const onTime = resolvedAt.getTime() <= complaint.dueAt!.getTime();
    if (onTime) met++;
    else missed++;

    const note = onTime
      ? "Attended on site, fault rectified and tested."
      : "Delayed by parts availability; fixed after the deadline.";

    await prisma.$transaction([
      prisma.complaint.update({
        where: { id: complaint.id },
        data: {
          status: "RESOLVED",
          resolvedAt,
          // Halfway between assignment and resolution, so "first touch"
          // reads as a plausible separate event rather than instantaneous.
          firstResponseAt: new Date(
            (complaint.assignedAt!.getTime() + resolvedAt.getTime()) / 2,
          ),
          resolutionNote: note,
        },
      }),
      prisma.complaintEvent.create({
        data: {
          complaintId: complaint.id,
          type: "RESOLVED",
          message: `Marked resolved: ${note}`,
          createdAt: resolvedAt,
        },
      }),
    ]);
  }

  console.log(
    `Resolved ${resolvable.length} tickets — ${met} inside SLA, ${missed} past it.\n`,
  );

  if (!CRON_SECRET) {
    console.log("CRON_SECRET not set — skipping the sweep. Run it yourself:");
    console.log(`  curl -X POST -H "Authorization: Bearer <secret>" ${BASE_URL}/api/cron/sla-sweep`);
    return;
  }

  console.log("Running the SLA sweep…");
  const sweep = await fetch(`${BASE_URL}/api/cron/sla-sweep`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const result = await sweep.json();

  if (!sweep.ok) {
    console.error("Sweep failed:", result);
    return;
  }

  console.log(`  checked ${result.checked} open tickets`);
  console.log(`  fired ${result.firedCount} escalation events:`);
  for (const event of result.fired) {
    console.log(
      `    ${event.code}  ${event.kind.padEnd(9)} ${event.rule}` +
        (event.escalatedTo ? ` → ${event.escalatedTo}` : ""),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
