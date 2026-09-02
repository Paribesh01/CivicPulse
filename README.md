# CivicPulse

**An AI system that reads, routes and watches every civic complaint until it's
actually fixed** — so *"streetlight has been dark for 5 days"* becomes an
assigned job with a ticking clock, not a form in a queue.

> This README is the single source of truth for the project. It is written so a
> teammate can build the deck and the pitch script straight from it. Every
> number quoted under [Measured results](#measured-results) came from the
> running system, not from an estimate.

---

## 1. The problem

Municipal helpdesks receive thousands of complaints a day: broken streetlights,
potholes, water leakage, garbage, blocked drains. Almost all of it still moves
through a manual pipeline — a clerk reads it, guesses the right department,
forwards it by hand, and moves on. **Nobody is watching the clock after that.**

The result is predictable:

- Identical complaints get wildly different response times depending on which
  clerk picked them up.
- Urgent complaints sit next to trivial ones with no way to tell them apart.
- Once a complaint is forwarded, nobody is accountable for what happens next.
- A citizen who complains has no idea whether anything happened at all.

**The complaint form is the easy part.** Most municipalities already have one,
and it hasn't solved the problem. What's missing is the accountability loop
*after* submission.

### The sentence the whole system is built around

> "Streetlight near XYZ school has not been working for 5 days."

That one sentence already contains everything a human triager would extract by
hand:

| Signal | Value | Why it matters |
|---|---|---|
| Category | Street lighting | Decides the department |
| Location | Near a named school | Decides the ward and the officer |
| Safety context | A *school* | Raises the priority |
| Age | 5 days | Raises it again |

CivicPulse extracts all four automatically, acts on them immediately, and keeps
escalating until someone with authority closes the loop.

---

## 2. What we built

An eight-stage pipeline with **zero manual handoffs** between intake and an
officer's queue.

| # | Stage | What happens | Where it lives |
|---|-------|--------------|----------------|
| 1 | **Complaint** | Citizen submits a photo + plain-language text | `POST /api/complaints` |
| 2 | **AI classification** | An LLM tags category, hazards, duration, intent | `src/lib/pipeline/classify.ts` |
| 3 | **Department detection** | Category maps to the responsible department | `CategoryRoute` table |
| 4 | **Priority calculation** | Weighted rules produce an urgency score | `src/lib/pipeline/priority.ts` |
| 5 | **Location detection** | Free text or GPS resolves to ward and zone | `src/lib/pipeline/location.ts` |
| 6 | **Nearest officer** | Jurisdiction + workload pick the owner | `src/lib/pipeline/assign.ts` |
| 7 | **Auto assignment** | Ticket + deadline land in the officer's queue | `src/lib/pipeline/intake.ts` |
| 8 | **SLA monitoring** | A sweep watches the clock and escalates itself | `src/lib/sla.ts` |

**Stage 8 is the point of the system.** Stages 2–7 exist to get a complaint
onto a clock as fast as possible. Stage 8 is what makes missing that clock have
consequences. Classification and routing exist in plenty of ticketing tools;
automatic, unattended escalation is what makes this a *government
accountability* system rather than a ticketing system.

### The escalation ladder

Rungs are stored as **fractions of each ticket's own SLA**, not fixed hours, so
one ladder fits a 4-hour clock on an open manhole and a 168-hour clock on tree
trimming:

| Fires at | Kind | Who is told |
|---|---|---|
| 50% | Reminder | Field officer |
| 83% | Warning | Officer + supervisor |
| 100% | **Escalate** | Supervisor |
| 150% | **Escalate again** | Department head |

Design properties worth stating in the pitch:

- **One sweep, not one timer per ticket.** A worker that was down catches up
  instead of losing deadlines.
- **Catch-up is ordered and exactly-once.** A ticket found 1.7× through its SLA
  fires *all four* rungs in one pass, in order, and never re-fires
  (`Complaint.lastRuleFired`).
- **Nobody has to remember to check.** That is the entire product.

---

## 3. Features in detail

### 3.1 Multilingual — Hindi and English

- Full bilingual UI, switchable from the header on **every** page.
- The choice is a cookie, so it works **signed-out** and applies immediately; a
  signed-in user's preference is also saved to their profile.
- No `/hi/...` URL segments — one set of routes serves both languages.
- The Hindi is written the way people **speak**, not formal Sanskritised
  government vocabulary.
- The classifier reads **English, Hindi and Hinglish** and replies to the
  citizen in their language while writing the officer-facing summary in English.

**Implementation:** `src/lib/i18n/dictionaries.ts`. The English dictionary is
the type contract (`const hi: typeof en`), so a **missing Hindi key is a
compile error**, not a blank space on a live page.

### 3.2 AI guidance — step by step, not a form

A four-step wizard where the system does the thinking:

```
1. Photo  →  2. Describe  →  3. Location  →  4. Check what we understood  →  Sent
```

Step 4 is the important one. Before anything is filed, the citizen sees — **in
their own language** — which department was picked, which ward, how urgent the
system judged it, and the deadline that follows. If something important is
missing (usually the location), the system asks **one short follow-up question**
in that language.

This is powered by `POST /api/complaints/analyze`, which runs stages 2–6 and
**writes nothing**.

> **Security note worth stating aloud:** submission does **not** trust the
> analysis the browser sends back. The pipeline is re-run server-side, because
> otherwise a crafted request could choose its own priority, department and
> deadline.

### 3.3 Mandatory login

A complaint is only registered for a signed-in citizen, so every report has a
traceable source and fake/spam complaints are answerable. Enforced at **four**
independent points — page, intake, analyze, and upload signing.

**Identity is still protected:** officers handling the repair see the citizen's
name so they can make contact. The public tracking page never shows it.

### 3.4 Photo evidence

- Mandatory wherever image storage is configured.
- Uploaded **straight from the phone to Cloudinary** using a server-generated
  signature — the image never passes through our server, which matters on the
  connections this app is meant to work on.
- The server only accepts URLs inside **our own** Cloudinary folder, so the
  field can't be pointed at any image on the internet.
- Thumbnails are generated by rewriting the delivery URL, so list pages stay
  light on slow connections.

### 3.5 Reward points

| Event | Points |
|---|---|
| Complaint filed | **+10** |
| The complaint gets fixed | **+25** |
| Citizen confirms the repair | **+5** |
| Complaint rejected as not genuine | **−20** |

Levels: **नागरिक** (0) → **जागरूक नागरिक** (100) → **इलाका प्रहरी** (300) →
**सिविक चैंपियन** (750)

Two design points to make in the pitch:

1. **Rejection costs more than filing earns**, so spam is *net-negative* rather
   than merely unrewarded. The incentive is to report *honestly*, not often.
2. **Points are an append-only ledger**, not a mutable counter, with a unique
   constraint on `(user, complaint, reason)`. A ticket that is resolved,
   reopened and resolved again **cannot be farmed**, and a retried request
   cannot double-pay.

### 3.6 UI/UX for the actual user

Built for someone on a mid-range Android phone, often outdoors, often not a
confident reader:

- Touch targets **≥ 44px**; primary buttons are 56px and full-width.
- Base text 17px, not 16px.
- 16px+ inputs so **iOS Safari doesn't zoom** on focus.
- Every action is **icon + text**, never icon alone.
- Status and urgency are carried by **shape and words**, not colour alone.
- Numbered steps with progress dots that read without literacy.
- Plain language throughout: "Being fixed", not "In progress · SLA 83%".

---

## 4. Measured results

Taken from the running system on the seeded demo dataset. **Quote these, not
estimates.**

### Routing quality

| Metric | Value |
|---|---|
| Complaints auto-assigned to a **named officer** | **57 / 57 (100%)** |
| LLM classifier — average confidence | **0.91** |
| LLM classifier — flagged for human review | **2 of 26 (8%)** |
| Keyword fallback — average confidence | 0.32 |
| Keyword fallback — flagged for human review | 31 of 31 (100%) |

> **The headline:** with the LLM, **92% of complaints route unattended**. The
> keyword fallback routes 0% unattended — by design, it flags everything,
> because a keyword guess should never masquerade as a confident decision.

### Speed

| Step | Time |
|---|---|
| **LLM classification** (full 28-category taxonomy) | **~0.75s** |
| — of which model compute | 0.19s |
| Trivial DB round-trip, laptop → Neon `us-east-2` | ~380ms |
| Full `/api/complaints/analyze` in dev | ~6s |

> **Be honest about the 6s if asked.** The AI is *not* the bottleneck — it is
> 0.75s. The rest is ~380ms per database round-trip because the dev laptop is
> in South Asia and the database is in US-East, times several sequential
> queries, plus dev-mode compilation. Deploying the app in the **same region as
> the database** (or moving Neon to `ap-southeast-1`) collapses this. See
> [Known limitations](#8-known-limitations).

### Reference data loaded

| Thing | Count |
|---|---|
| Departments | 9 |
| Wards | 6 |
| Complaint categories | 28 |
| Escalation rules | 4 |
| Staff accounts (officer / supervisor / dept head) | 25 |

### The SLA spread — the "one clock does not fit all" proof

| Category | Base SLA |
|---|---|
| Open manhole | **4 hours** |
| Burst water main | 4 hours |
| Exposed power line | 6 hours |
| Street lighting | 48 hours |
| Tree trimming | **168 hours** |

**A 42× spread**, before the urgency multiplier compresses it further. A burst
water main and a faded road marking do not share one clock.

### Accountability trail

23 complaints escalated at least once. 451 lifecycle events and 230
notifications recorded — this is the data trail that makes response times
per officer, per department and per ward comparable.

---

## 5. Live walkthrough — use these in the demo

All real output from the running system.

### The brief's own example (English)

```
Input:  "Streetlight near XYZ school has not been working for 5 days."

→ Category    Public Infrastructure › Street Lighting
→ Department  Municipal Electrical Maintenance
→ Priority    HIGH
               category baseline           +22
               near school                 +18
               unresolved 5 days            +6
               affects street               +4
               3 similar complaints nearby +12   ← varies, see below
→ Ward        Ward 14, Zone B          (matched the landmark "XYZ School")
→ Officer     J. Engineer — same ward
→ SLA         29 hours, clock started
```

> **Expect the total to differ between runs.** The first four signals are
> stable and always sum to **50**. The repeat-complaint bonus depends on how
> many similar open complaints already exist in that ward (capped at +12), so
> the score drifts up as the demo dataset grows. It lands **HIGH** either way.
> If a judge notices the number moving, that *is* the feature: a problem
> several people are reporting outranks one nobody else has mentioned.

### Hinglish — something keyword matching could never do

```
Input:  "Ghanta Ghar ke paas transformer se chingari nikal rahi hai"
        (sparks coming from the transformer near Ghanta Ghar)

→ Category    Exposed Power Line
→ Department  Municipal Electrical Maintenance
→ Ward        Ward 13, Zone B          (matched the landmark "Ghanta Ghar")
→ SLA         4 hours
```

### The AI asking for what's missing (Hindi UI)

```
Input:  "Nali choked hai aur ganda paani ghar ke andar aa raha hai"

→ Summary   नाली बंद है और गंदा पानी घर में आ रहा है।
→ Asks      कृपया नाली का सही पता बताइए?
→ Routes to Storm Water Drainage · 24h
```

```
Input:  "बिजली का तार लटक रहा है और चिंगारी निकल रही है"

→ Summary   लटकता हुआ बिजली का तार और चिंगारी, स्थान नहीं बताया गया
→ Asks      कृपया यह बताएं कि यह तार कहाँ लटका है?
→ Routes to Municipal Electrical Maintenance · HIGH · 4h
```

**Contrast to draw:** when the location *is* present, the system asks nothing.
It only interrupts when it genuinely needs something.

### The ladder climbing by itself

A ticket found 1.7× through its SLA, in a single sweep:

```
CP-10005  REMINDER  Halfway to deadline
CP-10005  WARNING   Deadline approaching        → SUPERVISOR
CP-10005  ESCALATE  SLA breached                → SUPERVISOR
CP-10005  ESCALATE  Still unresolved after breach → DEPT_HEAD
```

Run the sweep again immediately and it fires **nothing** — each rung fires once.

---

## 6. Architecture

### Request flow

```
Citizen (phone)
   │
   ├─ photo ──────────────────────────────────► Cloudinary  (direct, signed)
   │
   └─ text ──► /api/complaints/analyze ──► pipeline stages 2–6 ──► preview
                                                  │              (no writes)
                    citizen confirms              ▼
              ──► POST /api/complaints ──► pipeline re-run ──► Complaint row
                                                  │            + events
                                                  ▼            + notifications
                                          officer's queue      + points
                                                  │
                                    cron ──► /api/cron/sla-sweep ──► escalation
```

### Data model

| Model | Purpose |
|---|---|
| `User` | Citizens and staff. Carries `role`, `departmentId`, `wardId`, `locale`, `points` |
| `Department` | The 9 municipal departments |
| `Ward` | Jurisdiction + landmark `aliases` used for location matching |
| `CategoryRoute` | **The taxonomy.** Category → department, base SLA, severity weight, keyword cues |
| `EscalationRule` | The ladder, as fractions of each ticket's own SLA |
| `Complaint` | The ticket: classification, priority + signals, location, assignment, SLA, escalation state |
| `ComplaintEvent` | **Append-only audit trail** — the accountability data product |
| `Notification` | Per-user delivery records (in-app / SMS / push / email) |
| `PointsLedger` | Append-only reward ledger with anti-farming constraint |
| `Counter` | Source of the dense, human-readable `CP-#####` ticket numbers |

### Key design decisions (each is a talking point)

**Everything the router decides on is data, not code.** Department mappings,
SLA hours, severity weights, escalation thresholds, ward aliases and the officer
roster are all rows. Onboarding a new city or department is a **data load, not a
rebuild**. `/dashboard/admin` shows the live configuration.

**The classifier can only return a category some department already owns.** The
taxonomy is built from `CategoryRoute` into a zod schema, converted to JSON
Schema, and sent to Groq in **strict mode** — so the model *cannot invent a
department that doesn't exist*. The same zod schema validates the response, so
the constraint and the check cannot drift apart.

**Intake never hard-fails on the model.** No API key, or the call fails? It
degrades to keyword matching against the same table and flags the ticket for
review. **The demo works with no AI key at all.**

**Priority is attributable.** Every point is stored with the signal that earned
it, so an officer can see exactly *why* one ticket outranks another instead of
being handed an opaque number.

**The clock starts at assignment, not submission.** An officer cannot be held to
a deadline that began before they had the job. Reassignment **carries the
original deadline**, so handing a ticket over doesn't buy more time.

**Scope is applied in the query, not after it.** `complaintScope()` in
`src/lib/scope.ts` is the single definition of who sees what. An out-of-scope
ticket returns **404, not 403** — a 403 would confirm the ticket exists.

---

## 7. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | One codebase for UI + API; server components keep the client bundle small for low-end phones |
| Database | **PostgreSQL** (Neon) | Relational fits ticket/officer/jurisdiction data; PostGIS available later for real ward shapefiles |
| ORM | **Prisma 7** | Typed schema; migrations are reviewable SQL |
| Auth | **better-auth** | Email/password + role-based access, five roles |
| AI | **Groq** (`openai/gpt-oss-120b`) | Strict JSON-schema output, ~0.75s, open model — no lock-in |
| Photos | **Cloudinary** | Signed direct upload keeps images off our server |
| Styling | **Tailwind v4** | Design tokens shared with the pitch document |

**Why an open model on Groq:** the taxonomy constrains the output, so we do not
need a frontier model to pick from 28 categories. Strict JSON-schema mode plus
speed matters more than raw capability, and an open model means no vendor
lock-in for a government deployment.

---

## 8. Known limitations

State these before a judge finds them.

- **Latency in dev is dominated by geography**, not AI. ~380ms per DB
  round-trip from South Asia to `us-east-2`. Fix: deploy app and database in
  the same region (`ap-southeast-1` for India).
- **Ward matching is alias-based, not geometric.** Real deployment needs
  geocoding + ward shapefiles. Only `resolveWard()` changes — everything
  downstream consumes a `Ward`.
- **Notifications are recorded, not delivered.** Rows are written and dispatch
  is logged; wiring an SMS gateway is a change to `src/lib/notify.ts` alone.
- **The staff dashboard is English-only.** Deliberate — officers work in
  English-language systems. The citizen-facing half is fully bilingual.
- **Duplicate detection raises priority rather than merging.** See
  [Open questions](#12-open-questions).
- **Officer rosters are simulated**, not sourced from a real municipality.

---

## 9. Feasibility, viability, impact

Framed the way SIH judges ask.

**Feasibility.** Every core piece has an off-the-shelf building block:
multilingual LLM classification, geocoding APIs, ward shapefiles from open-data
portals, job scheduling. Nothing here needs new research — it needs good
integration and a clean rules engine. **It is already built and running.**

**Viability.** A pilot fits one ward or one department before scaling
city-wide, which matches how government pilots are actually funded. Onboarding a
new department is a config change: add rows to `Department`, `CategoryRoute` and
the officer roster. No redeploy.

**Impact.** Faster resolution on safety-relevant complaints; visible
accountability per officer, department and ward; and a citizen who can see their
ticket's deadline instead of wondering whether it went anywhere.

**Scalability.** Department mappings, SLA thresholds, escalation rungs and ward
data are **all data**. The same pipeline extends to a new city by loading its
jurisdiction data — not by re-architecting. The sweep is a single pass over open
tickets, so cost grows with *open* tickets, not total tickets.

---

## 10. Demo script

Have the dev server running, `pnpm db:seed` and `pnpm demo` already done.

**1 — The problem (30s).** Open `/`. Read the hero. Point out the four numbered
steps and say the deck's line: *"the complaint form is the easy part."*

**2 — Language (15s).** Hit the **हिंदी** toggle in the header. The whole page
switches. Say: *"one cookie, no separate URLs, works signed out."*

**3 — Mandatory login (15s).** Click **शिकायत दर्ज करें**. It redirects to
login. Say: *"a complaint with no traceable source can't be held to any
standard of authenticity."* Sign in as `ravi@example.com` / `civicpulse123`.

**4 — The guided flow (90s).** This is the centrepiece.
   - Step 1 asks for a photo.
   - Step 2 — type the Hinglish line:
     `Ghanta Ghar ke paas transformer se chingari nikal rahi hai`
   - Step 3 — leave the location blank on purpose.
   - Step 4 — **pause here.** The system shows the department, the ward, the
     urgency and the deadline *in Hindi*, and asks a follow-up question in
     Hindi. Say: *"it only asks when something is genuinely missing."*
   - Submit. Show the ticket number and **+10 points**.

**5 — The citizen's view (20s).** Go to the dashboard. Show the points, the
level, and the live countdown on the ticket.

**6 — The officer's view (40s).** Sign in as `je.elec.b@civicpulse.gov.in`.
Show the queue **sorted by deadline, not by priority** — say: *"a critical
ticket with two days left is less urgent than a routine one that breached this
morning."* Open a ticket and show the priority breakdown: every point
attributable.

**7 — The payoff (45s).** Run `pnpm sweep`. Show the ladder firing and
escalating to SUPERVISOR and DEPT_HEAD. Run it **again** — nothing fires. Say:
*"exactly once, and it catches up if the worker was down."*

**8 — The real product (30s).** Open `/dashboard/analytics` as
`admin@civicpulse.gov.in`. Response times per officer, per department, per
ward. Close with: *"none of these numbers existed before. You can't manage what
isn't measured."*

### Likely judge questions

**"What if the AI gets it wrong?"** Low-confidence classifications still route —
waiting is worse than routing imperfectly — but they're flagged `needsReview`
and surfaced to a supervisor. Measured: 8% flagged. And the model can only
pick from categories a department actually owns.

**"What if the AI is down?"** Intake degrades to keyword matching and flags
everything for review. It never fails the citizen. Demo it by unsetting
`GROQ_API_KEY`.

**"What stops fake complaints?"** Mandatory login, mandatory photo, and a
reward system where rejection costs more than filing earns.

**"Can officers game it?"** The clock starts at assignment, reassignment
carries the original deadline, and the ladder escalates above them
automatically. Points can't be farmed by reopen/re-resolve cycles.

**"How is this different from existing portals?"** Existing portals stop at
submission. Show the sweep firing with nobody logged in.

---

## 11. Suggested team split

| Role | Owns |
|---|---|
| AI / NLP | Classification prompt, taxonomy, priority weights |
| Backend | Ticket lifecycle, SLA sweep, escalation engine, rewards |
| Geo / data | Ward mapping, department routing, officer roster |
| Frontend — citizen | Report wizard, tracking, i18n |
| Frontend — staff | Queue, complaint detail, analytics |
| DevOps | Deployment, demo environment, notification gateways |

---

## 12. Open questions

Decide these before the final pitch — judges often probe them.

- **Duplicate detection.** Repeat complaints about the same category in the
  same ward currently **raise priority** (capped at +12) rather than merging,
  so no citizen's report is silently discarded. Merging is the other defensible
  choice — be ready to justify whichever you keep.
- **Languages beyond Hindi.** The architecture is locale-agnostic; adding a
  language is one dictionary file plus one line in `LOCALES`.
- **Officer directory.** Simulated roster, or an anonymised real one for
  credibility?
- **Offline access.** Does the citizen app need to work without connectivity?
- **Data privacy.** What citizen data genuinely needs storing versus being used
  transiently? Currently: name, email, optional phone, optional GPS.

---

## 13. Getting started

```bash
pnpm install
cp .env.example .env      # then fill in DATABASE_URL and DIRECT_URL
pnpm db:migrate           # or `pnpm db:deploy` against an existing database
pnpm db:seed              # departments, wards, categories, rules, demo staff
pnpm dev
```

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string |
| `DIRECT_URL` | yes | Neon **direct** string (host without `-pooler`) — migrations run DDL |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | production only | Leave empty in dev; the origin is inferred so any port works |
| `GROQ_API_KEY` | no | Without it, classification falls back to keyword matching |
| `GROQ_MODEL` | no | Defaults to `openai/gpt-oss-120b` |
| `CLOUDINARY_CLOUD_NAME` | no | Set all three to make photo evidence **mandatory** |
| `CLOUDINARY_API_KEY` | no | |
| `CLOUDINARY_API_SECRET` | no | Never sent to the browser — only the per-upload signature is |
| `CRON_SECRET` | yes | The sweep endpoint refuses to run without it |

### Demo accounts

Every seeded account uses the password `civicpulse123`:

| Email | Role |
|---|---|
| `ravi@example.com` | **Citizen**, Ward 14 — use this for the demo |
| `je.elec.b@civicpulse.gov.in` | Field officer, Ward 14 (the brief's *J. Engineer*) |
| `sup.elec@civicpulse.gov.in` | Supervisor, Electrical — can reassign |
| `head.elec@civicpulse.gov.in` | Department head, Electrical |
| `admin@civicpulse.gov.in` | Administrator — sees every department |

### Useful commands

```bash
pnpm dev          # dev server
pnpm demo         # file 15 complaints via the real API, backdate clocks, sweep
pnpm sweep        # fire the SLA sweep on demand (great for the demo)
pnpm db:seed      # reload reference data
pnpm db:studio    # browse the database
pnpm typecheck    # tsc --noEmit
pnpm lint
```

`pnpm demo` and `pnpm sweep` accept `BASE_URL` if you aren't on port 3000.

---

## 14. Deploying

The generated Prisma client lives in `src/generated` and is **gitignored**, so a
deploy host clones without it. Both `postinstall` and `build` run
`prisma generate` to cover that — `postinstall` for a normal install, `build`
for hosts that restore a cached `node_modules` and skip postinstall. **Don't
remove either.**

Set these on the host (there is no `.env` in a deployment):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string |
| `DIRECT_URL` | Neon **direct** string — host without `-pooler` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | **The deployed origin**, e.g. `https://civicpulse.vercel.app` |
| `GROQ_API_KEY` | Your Groq key |
| `CLOUDINARY_*` | All three, to enforce photo evidence |
| `CRON_SECRET` | `openssl rand -base64 32` — not the dev placeholder |

`BETTER_AUTH_URL` is optional in dev but **required in production**: without it
better-auth derives the origin from each request, and sign-in callbacks can land
on the wrong host.

**Deploy the app in the same region as the database.** This is the single
biggest performance lever — see [Known limitations](#8-known-limitations).

Apply migrations as a release step:

```bash
pnpm db:deploy      # prisma migrate deploy — runs over DIRECT_URL
pnpm db:seed        # only for a fresh database
```

Keep migrations out of the build command; parallel builds would race for the
same advisory lock.

### Running the SLA sweep in production

```
*/5 * * * * curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<host>/api/cron/sla-sweep
```

Safe to run as often as you like — each rung fires once per ticket, tracked by
`Complaint.lastRuleFired`.
