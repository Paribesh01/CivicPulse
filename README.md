# CivicPulse

An AI system that reads, routes and watches every civic complaint until it's
actually fixed — so *"streetlight has been dark for 5 days"* becomes an assigned
job with a ticking clock, not a form in a queue.

The complaint form is the easy part. What's missing in most municipal systems is
the loop *after* submission: something that keeps a complaint from dying quietly
in a forwarded email, and that leaves behind response times per officer, per
department and per ward that can actually be compared.

## The pipeline

A complaint moves through eight stages with no manual handoffs:

| # | Stage | Where it lives |
|---|-------|----------------|
| 1 | Complaint intake (web, app, IVR, SMS) | `POST /api/complaints` |
| 2 | AI classification | `src/lib/pipeline/classify.ts` |
| 3 | Department detection | `CategoryRoute` table lookup |
| 4 | Priority calculation | `src/lib/pipeline/priority.ts` |
| 5 | Location detection | `src/lib/pipeline/location.ts` |
| 6 | Nearest responsible officer | `src/lib/pipeline/assign.ts` |
| 7 | Automatic assignment + SLA start | `src/lib/pipeline/intake.ts` |
| 8 | SLA monitoring and escalation | `src/lib/sla.ts` |

Stage 8 is the point of the system. Stages 2–7 exist to get a complaint onto a
clock as fast as possible; stage 8 is what makes missing that clock have
consequences.

### The escalation ladder

Rungs are stored as **fractions of each ticket's own SLA**, not fixed hours, so
one ladder fits a 4-hour clock on a burst water main and a 168-hour clock on
tree trimming:

| Fires at | Kind | Notifies |
|---|---|---|
| 50% | Reminder | Field officer |
| 83% | Warning | Officer + supervisor |
| 100% | Escalate | Supervisor |
| 150% | Escalate | Department head |

One sweep checks every open ticket rather than one timer per ticket, so a worker
that was down catches up instead of losing deadlines. A ticket found well past
its deadline fires every rung it missed, in order, exactly once.

## Stack

- **Next.js 16** (App Router, server components, server actions)
- **PostgreSQL** on Neon + **Prisma 7** (driver adapter, `prisma.config.ts`)
- **better-auth** with role-based access (citizen / officer / supervisor / department head / admin)
- **Groq** (`openai/gpt-oss-120b`) for classification, via strict JSON-schema output against a closed taxonomy
- Tailwind v4

## Getting started

```bash
pnpm install
cp .env.example .env      # then fill in DATABASE_URL and DIRECT_URL
pnpm db:migrate           # or `pnpm db:deploy` against an existing database
pnpm db:seed              # departments, wards, category routes, escalation rules, demo staff
pnpm dev
```

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string |
| `DIRECT_URL` | yes | Neon **direct** string — migrations run DDL, which the pooler refuses |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | production only | Leave empty in dev; the origin is inferred from the request so any port works |
| `GROQ_API_KEY` | no | Without it, classification falls back to keyword matching and flags tickets for review |
| `GROQ_MODEL` | no | Defaults to `openai/gpt-oss-120b`. Any Groq model with strict JSON-schema support works |
| `CRON_SECRET` | yes | The sweep endpoint refuses to run without it |

### Demo accounts

Every seeded account uses the password `civicpulse123`:

| Email | Role |
|---|---|
| `admin@civicpulse.gov.in` | Administrator — sees every department |
| `head.elec@civicpulse.gov.in` | Department head, Electrical |
| `sup.elec@civicpulse.gov.in` | Supervisor, Electrical — can reassign |
| `je.elec.b@civicpulse.gov.in` | Field officer, Ward 14 (the brief's *J. Engineer*) |
| `ravi@example.com` | Citizen, Ward 14 |

### Populating a demo dataset

With the dev server running:

```bash
pnpm demo          # files 15 complaints through the real API, backdates some
                   # clocks, resolves a few, then runs the sweep
pnpm sweep         # fire the sweep again on demand
```

Both accept `BASE_URL` if you aren't on port 3000.

## Deploying

The generated Prisma client lives in `src/generated` and is **gitignored**, so
a deploy host clones without it. Both `postinstall` and `build` run
`prisma generate` to cover that — `postinstall` for a normal install, and
`build` for hosts that restore a cached `node_modules` and skip postinstall.
Don't remove either.

Set these on the host (there is no `.env` in a deployment):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string |
| `DIRECT_URL` | Neon **direct** string — the host without `-pooler` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | **The deployed origin**, e.g. `https://civicpulse.vercel.app` |
| `GROQ_API_KEY` | Your Groq key |
| `CRON_SECRET` | `openssl rand -base64 32` — not the dev placeholder |

`BETTER_AUTH_URL` is optional in dev but **required in production**: without it
better-auth derives the origin from each incoming request, and sign-in
callbacks and redirects can land on the wrong host.

Apply migrations as a release step, before or just after the first boot:

```bash
pnpm db:deploy      # prisma migrate deploy — runs over DIRECT_URL
pnpm db:seed        # only for a fresh database
```

Keep migrations out of the build command; parallel builds would race for the
same advisory lock.

## Running the SLA sweep in production

Point any scheduler at the endpoint:

```
*/5 * * * * curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<host>/api/cron/sla-sweep
```

It's safe to run as often as you like — each rung fires once per ticket, tracked
by `Complaint.lastRuleFired`.

## Design notes

**Everything the router decides on is data, not code.** Department mappings, SLA
hours, severity weights, escalation thresholds, ward aliases and the officer
roster are all rows. Onboarding a new city or department is a data load, not a
rebuild. `/dashboard/admin` shows the live configuration.

**The classifier can only return a category some department already owns.** The
taxonomy is built from the `CategoryRoute` table into a zod schema, which is
converted to JSON Schema and sent to Groq in strict mode — so the model cannot
invent a department that doesn't exist. That same zod schema validates the
response, so the constraint and the check can't drift apart. Low-confidence
results still route (waiting is worse than routing imperfectly) but are flagged
`needsReview` and surfaced to a supervisor.

**Intake never hard-fails on the model.** If the API key is missing or the call
fails, classification degrades to keyword matching against the same table and
the ticket is flagged for review. The demo works with no API key at all.

**Priority is attributable.** Every point in a ticket's score is stored with the
signal that produced it, so an officer can see exactly why one ticket outranks
another rather than being handed an opaque number.

**The clock starts at assignment, not submission.** An officer can't be held to a
deadline that began before they had the job. Reassignment carries the original
deadline with it, so handing a ticket over doesn't buy more time.

**Scope is applied in the query, not after it.** `complaintScope()` in
`src/lib/scope.ts` is the single definition of who can see what; an out-of-scope
ticket 404s rather than returning a message that confirms it exists.

## Open questions from the brief

These are deliberately unresolved and worth deciding before the pitch:

- **Duplicate detection.** Repeat complaints about the same category in the same
  ward currently raise priority (capped at +12) rather than auto-merging, so no
  citizen's report is silently discarded. Merging is the other defensible choice.
- **Languages.** The classifier prompt handles English, Hindi and Hinglish and
  answers in English; the seeded keyword fallback is English-only.
- **Geocoding.** Location resolution matches ward aliases and does
  nearest-centroid on a GPS pin. Swapping in a real geocoder plus ward
  shapefiles means replacing `resolveWard()` and nothing else.
- **Notification delivery.** Notifications are written as rows and logged;
  wiring an SMS gateway is a change to `src/lib/notify.ts` alone.
