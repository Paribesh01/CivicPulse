import "dotenv/config";

/// Triggers the SLA sweep against a running server. Handy during a demo when
/// you want to show the ladder firing on demand rather than waiting for cron.
///
///   pnpm sweep
///   BASE_URL=http://localhost:3003 pnpm sweep

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;

async function main() {
  if (!CRON_SECRET) {
    console.error("CRON_SECRET is not set in .env — the endpoint will refuse.");
    process.exit(1);
  }

  const response = await fetch(`${BASE_URL}/api/cron/sla-sweep`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });

  const result = await response.json();
  if (!response.ok) {
    console.error(`Sweep failed (${response.status}):`, result);
    process.exit(1);
  }

  console.log(`Checked ${result.checked} open tickets at ${result.sweptAt}`);
  if (result.firedCount === 0) {
    console.log("No thresholds crossed since the last sweep.");
    return;
  }

  console.log(`Fired ${result.firedCount} events:`);
  for (const event of result.fired) {
    console.log(
      `  ${event.code}  ${event.kind.padEnd(9)} ${event.rule}` +
        (event.escalatedTo ? ` → ${event.escalatedTo}` : ""),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
