import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Role } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/// Every demo account uses this. Fine for a hackathon; the signup form
/// enforces the same 8-character minimum for real users.
const DEMO_PASSWORD = "civicpulse123";

/// What better-auth stamps on email/password accounts.
const CREDENTIAL_ISSUER = "local:credential";

const DEPARTMENTS = [
  { code: "ELEC", name: "Municipal Electrical Maintenance", contactMail: "elec@civicpulse.gov.in" },
  { code: "PWD", name: "Public Works Department (Roads)", contactMail: "pwd@civicpulse.gov.in" },
  { code: "WATER", name: "Water Supply & Sewerage Board", contactMail: "water@civicpulse.gov.in" },
  { code: "SAN", name: "Sanitation & Solid Waste", contactMail: "sanitation@civicpulse.gov.in" },
  { code: "DRAIN", name: "Storm Water Drainage", contactMail: "drainage@civicpulse.gov.in" },
  { code: "PARKS", name: "Parks & Horticulture", contactMail: "parks@civicpulse.gov.in" },
  { code: "HEALTH", name: "Public Health", contactMail: "health@civicpulse.gov.in" },
  { code: "TRAFFIC", name: "Traffic & Transport", contactMail: "traffic@civicpulse.gov.in" },
  { code: "GEN", name: "General Grievance Cell", contactMail: "grievance@civicpulse.gov.in" },
];

const WARDS = [
  { code: "W-11", name: "Ward 11", zone: "Zone A", lat: 26.4712, lng: 80.3312, aliases: ["Gandhi Nagar", "Central Market", "Rail Bazaar"] },
  { code: "W-12", name: "Ward 12", zone: "Zone A", lat: 26.4805, lng: 80.3401, aliases: ["Model Town", "Civil Lines", "Company Bagh"] },
  { code: "W-13", name: "Ward 13", zone: "Zone B", lat: 26.4521, lng: 80.3188, aliases: ["Shastri Nagar", "Bus Stand", "Ghanta Ghar"] },
  { code: "W-14", name: "Ward 14", zone: "Zone B", lat: 26.4488, lng: 80.3095, aliases: ["XYZ School", "Nehru Colony", "Green Park", "Saraswati Vidya Mandir"] },
  { code: "W-15", name: "Ward 15", zone: "Zone C", lat: 26.4390, lng: 80.2980, aliases: ["Indira Nagar", "District Hospital", "Kalyanpur"] },
  { code: "W-16", name: "Ward 16", zone: "Zone C", lat: 26.4301, lng: 80.2865, aliases: ["Sector 9", "Industrial Area", "Panki Road"] },
];

/// key, label, group, department, base SLA hours, severity weight (0-40), cues
const CATEGORIES: [string, string, string, string, number, number, string[]][] = [
  ["street_lighting", "Street Lighting", "Public Infrastructure", "ELEC", 48, 22, ["streetlight", "street light", "lamp post", "dark", "bulb", "not working"]],
  ["power_line_hazard", "Exposed Power Line", "Public Infrastructure", "ELEC", 6, 38, ["live wire", "electric wire", "spark", "shock", "transformer"]],
  ["power_outage", "Power Outage", "Public Infrastructure", "ELEC", 12, 26, ["power cut", "no electricity", "outage", "bijli"]],

  ["pothole", "Pothole", "Roads", "PWD", 72, 20, ["pothole", "gaddha", "hole in road"]],
  ["road_damage", "Damaged Road Surface", "Roads", "PWD", 96, 16, ["broken road", "road damage", "cracked road"]],
  ["footpath_damage", "Damaged Footpath", "Roads", "PWD", 120, 10, ["footpath", "pavement", "sidewalk"]],

  ["water_main_burst", "Burst Water Main", "Water", "WATER", 4, 38, ["burst", "pipeline broken", "water gushing"]],
  ["water_leakage", "Water Leakage", "Water", "WATER", 24, 26, ["leak", "leakage", "dripping pipe", "water waste"]],
  ["no_water_supply", "No Water Supply", "Water", "WATER", 24, 28, ["no water", "water supply", "paani nahi"]],
  ["contaminated_water", "Contaminated Water", "Water", "WATER", 8, 36, ["dirty water", "smelly water", "contaminated", "muddy water"]],
  ["sewage_overflow", "Sewage Overflow", "Water", "WATER", 12, 34, ["sewage", "sewer", "overflow", "gutter overflow"]],

  ["garbage_missed", "Garbage Not Collected", "Sanitation", "SAN", 48, 14, ["garbage", "kachra", "not collected", "waste pickup"]],
  ["garbage_dump", "Illegal Garbage Dump", "Sanitation", "SAN", 72, 16, ["dumping", "garbage pile", "trash heap"]],
  ["dead_animal", "Dead Animal Removal", "Sanitation", "SAN", 12, 22, ["dead animal", "dead dog", "carcass"]],
  ["public_toilet", "Public Toilet Maintenance", "Sanitation", "SAN", 72, 12, ["public toilet", "sulabh", "washroom"]],

  ["manhole_open", "Open Manhole", "Drainage", "DRAIN", 4, 40, ["open manhole", "manhole cover", "uncovered drain"]],
  ["waterlogging", "Waterlogging", "Drainage", "DRAIN", 12, 30, ["waterlogging", "flooded", "water filled", "jal bharav"]],
  ["drain_blockage", "Blocked Drain", "Drainage", "DRAIN", 24, 24, ["drain blocked", "nali", "choked drain"]],

  ["tree_fallen", "Fallen Tree", "Parks", "PARKS", 8, 32, ["tree fallen", "tree collapsed", "branch fell"]],
  ["tree_trimming", "Tree Trimming", "Parks", "PARKS", 168, 8, ["overgrown", "trimming", "branches"]],
  ["park_maintenance", "Park Maintenance", "Parks", "PARKS", 168, 8, ["park", "playground", "garden"]],

  ["mosquito_breeding", "Mosquito Breeding", "Public Health", "HEALTH", 72, 20, ["mosquito", "dengue", "breeding", "fogging"]],
  ["stray_animal", "Stray Animal Menace", "Public Health", "HEALTH", 48, 18, ["stray dog", "stray cattle", "animal menace"]],
  ["food_safety", "Food Safety Violation", "Public Health", "HEALTH", 48, 24, ["food safety", "stale food", "unhygienic"]],

  ["traffic_signal", "Traffic Signal Fault", "Traffic", "TRAFFIC", 12, 30, ["traffic signal", "traffic light", "signal not working"]],
  ["illegal_parking", "Illegal Parking", "Traffic", "TRAFFIC", 48, 10, ["illegal parking", "encroachment", "parked"]],
  ["signage_damage", "Damaged Road Signage", "Traffic", "TRAFFIC", 120, 10, ["signboard", "road sign", "faded marking"]],

  ["other", "Uncategorised Grievance", "General", "GEN", 72, 10, []],
];

/// The ladder from the brief, expressed as fractions of each ticket's own SLA
/// so a 4-hour clock and a 168-hour clock escalate on the same shape.
const ESCALATION_RULES: {
  sequence: number;
  fraction: number;
  kind: "REMINDER" | "WARNING" | "ESCALATE";
  label: string;
  notifyAssignee: boolean;
  notifyRole: Role | null;
}[] = [
  { sequence: 1, fraction: 0.5, kind: "REMINDER", label: "Halfway to deadline", notifyAssignee: true, notifyRole: null },
  { sequence: 2, fraction: 0.833, kind: "WARNING", label: "Deadline approaching", notifyAssignee: true, notifyRole: "SUPERVISOR" },
  { sequence: 3, fraction: 1.0, kind: "ESCALATE", label: "SLA breached", notifyAssignee: true, notifyRole: "SUPERVISOR" },
  { sequence: 4, fraction: 1.5, kind: "ESCALATE", label: "Still unresolved after breach", notifyAssignee: true, notifyRole: "DEPT_HEAD" },
];

type StaffSpec = {
  name: string;
  email: string;
  role: Role;
  dept?: string;
  ward?: string;
};

const STAFF: StaffSpec[] = [
  { name: "Asha Verma", email: "admin@civicpulse.gov.in", role: "ADMIN" },

  { name: "R. Krishnan", email: "head.elec@civicpulse.gov.in", role: "DEPT_HEAD", dept: "ELEC" },
  { name: "Meena Iyer", email: "head.water@civicpulse.gov.in", role: "DEPT_HEAD", dept: "WATER" },
  { name: "S. Prakash", email: "head.pwd@civicpulse.gov.in", role: "DEPT_HEAD", dept: "PWD" },
  { name: "Farida Sheikh", email: "head.san@civicpulse.gov.in", role: "DEPT_HEAD", dept: "SAN" },
  { name: "Vikram Rao", email: "head.drain@civicpulse.gov.in", role: "DEPT_HEAD", dept: "DRAIN" },

  { name: "Neha Gupta", email: "sup.elec@civicpulse.gov.in", role: "SUPERVISOR", dept: "ELEC", ward: "W-14" },
  { name: "Arun Nair", email: "sup.water@civicpulse.gov.in", role: "SUPERVISOR", dept: "WATER", ward: "W-12" },
  { name: "Pooja Sharma", email: "sup.pwd@civicpulse.gov.in", role: "SUPERVISOR", dept: "PWD", ward: "W-13" },
  { name: "Imran Qureshi", email: "sup.san@civicpulse.gov.in", role: "SUPERVISOR", dept: "SAN", ward: "W-15" },
  { name: "Deepak Joshi", email: "sup.drain@civicpulse.gov.in", role: "SUPERVISOR", dept: "DRAIN", ward: "W-11" },

  { name: "J. Engineer", email: "je.elec.b@civicpulse.gov.in", role: "OFFICER", dept: "ELEC", ward: "W-14" },
  { name: "Kavita Singh", email: "je.elec.a@civicpulse.gov.in", role: "OFFICER", dept: "ELEC", ward: "W-11" },
  { name: "Suresh Yadav", email: "je.elec.c@civicpulse.gov.in", role: "OFFICER", dept: "ELEC", ward: "W-16" },

  { name: "Ramesh Patil", email: "je.water.a@civicpulse.gov.in", role: "OFFICER", dept: "WATER", ward: "W-12" },
  { name: "Sunita Das", email: "je.water.b@civicpulse.gov.in", role: "OFFICER", dept: "WATER", ward: "W-13" },

  { name: "Manoj Tiwari", email: "je.pwd.b@civicpulse.gov.in", role: "OFFICER", dept: "PWD", ward: "W-13" },
  { name: "Anita Kumari", email: "je.pwd.c@civicpulse.gov.in", role: "OFFICER", dept: "PWD", ward: "W-15" },

  { name: "Balram Singh", email: "je.san.c@civicpulse.gov.in", role: "OFFICER", dept: "SAN", ward: "W-15" },
  { name: "Rekha Devi", email: "je.san.a@civicpulse.gov.in", role: "OFFICER", dept: "SAN", ward: "W-11" },

  { name: "Naveen Chandra", email: "je.drain.a@civicpulse.gov.in", role: "OFFICER", dept: "DRAIN", ward: "W-11" },
  { name: "Ganesh Pawar", email: "je.drain.b@civicpulse.gov.in", role: "OFFICER", dept: "DRAIN", ward: "W-14" },

  { name: "Lalita Menon", email: "je.parks@civicpulse.gov.in", role: "OFFICER", dept: "PARKS", ward: "W-12" },
  { name: "Zoya Khan", email: "je.health@civicpulse.gov.in", role: "OFFICER", dept: "HEALTH", ward: "W-16" },
  { name: "Harish Bhat", email: "je.traffic@civicpulse.gov.in", role: "OFFICER", dept: "TRAFFIC", ward: "W-11" },
  { name: "Om Prakash", email: "je.gen@civicpulse.gov.in", role: "OFFICER", dept: "GEN", ward: "W-11" },
];

const CITIZENS: { name: string; email: string; ward: string; phone: string }[] = [
  { name: "Ravi Kumar", email: "ravi@example.com", ward: "W-14", phone: "+91 98200 11111" },
  { name: "Priya Menon", email: "priya@example.com", ward: "W-12", phone: "+91 98200 22222" },
];

async function upsertUser(
  spec: StaffSpec & { phone?: string },
  deptIds: Map<string, string>,
  wardIds: Map<string, string>,
  passwordHash: string,
) {
  const existing = await prisma.user.findUnique({ where: { email: spec.email } });
  const id = existing?.id ?? randomUUID();

  await prisma.user.upsert({
    where: { email: spec.email },
    create: {
      id,
      name: spec.name,
      email: spec.email,
      emailVerified: true,
      role: spec.role,
      phone: spec.phone ?? null,
      departmentId: spec.dept ? deptIds.get(spec.dept) : null,
      wardId: spec.ward ? wardIds.get(spec.ward) : null,
    },
    update: {
      name: spec.name,
      role: spec.role,
      departmentId: spec.dept ? deptIds.get(spec.dept) : null,
      wardId: spec.ward ? wardIds.get(spec.ward) : null,
    },
  });

  // better-auth 1.7 finds a credential account by (issuer, accountId), so
  // both must match what the sign-in path looks for.
  await prisma.account.upsert({
    where: { issuer_accountId: { issuer: CREDENTIAL_ISSUER, accountId: id } },
    create: {
      id: randomUUID(),
      issuer: CREDENTIAL_ISSUER,
      accountId: id,
      providerId: "credential",
      userId: id,
      password: passwordHash,
    },
    update: { password: passwordHash },
  });

  return id;
}

async function main() {
  console.log("Seeding CivicPulse reference data…");

  const deptIds = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const row = await prisma.department.upsert({
      where: { code: dept.code },
      create: dept,
      update: { name: dept.name, contactMail: dept.contactMail },
    });
    deptIds.set(dept.code, row.id);
  }
  console.log(`  ${DEPARTMENTS.length} departments`);

  const wardIds = new Map<string, string>();
  for (const ward of WARDS) {
    const row = await prisma.ward.upsert({
      where: { code: ward.code },
      create: ward,
      update: { name: ward.name, zone: ward.zone, aliases: ward.aliases, lat: ward.lat, lng: ward.lng },
    });
    wardIds.set(ward.code, row.id);
  }
  console.log(`  ${WARDS.length} wards`);

  for (const [key, label, group, dept, sla, severity, keywords] of CATEGORIES) {
    await prisma.categoryRoute.upsert({
      where: { key },
      create: {
        key,
        label,
        group,
        baseSlaHours: sla,
        severityWeight: severity,
        keywords,
        departmentId: deptIds.get(dept)!,
      },
      update: {
        label,
        group,
        baseSlaHours: sla,
        severityWeight: severity,
        keywords,
        departmentId: deptIds.get(dept)!,
      },
    });
  }
  console.log(`  ${CATEGORIES.length} category routes`);

  for (const rule of ESCALATION_RULES) {
    // Global rules carry a null departmentId, which Prisma cannot address
    // through the compound unique, so match them explicitly.
    const existing = await prisma.escalationRule.findFirst({
      where: { departmentId: null, sequence: rule.sequence },
      select: { id: true },
    });

    if (existing) {
      await prisma.escalationRule.update({ where: { id: existing.id }, data: rule });
    } else {
      await prisma.escalationRule.create({ data: { ...rule, departmentId: null } });
    }
  }
  console.log(`  ${ESCALATION_RULES.length} escalation rules`);

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const spec of STAFF) {
    await upsertUser(spec, deptIds, wardIds, passwordHash);
  }
  console.log(`  ${STAFF.length} staff accounts`);

  for (const citizen of CITIZENS) {
    await upsertUser(
      { ...citizen, role: "CITIZEN", ward: citizen.ward },
      deptIds,
      wardIds,
      passwordHash,
    );
  }
  console.log(`  ${CITIZENS.length} citizen accounts`);

  await prisma.counter.upsert({
    where: { name: "complaint" },
    create: { name: "complaint", value: 10001 },
    update: {},
  });

  console.log("\nDone. Every demo account uses the password: " + DEMO_PASSWORD);
  console.log("  admin@civicpulse.gov.in       (ADMIN)");
  console.log("  head.elec@civicpulse.gov.in   (DEPT_HEAD, Electrical)");
  console.log("  sup.elec@civicpulse.gov.in    (SUPERVISOR, Electrical)");
  console.log("  je.elec.b@civicpulse.gov.in   (OFFICER, Ward 14 — the brief's J. Engineer)");
  console.log("  ravi@example.com              (CITIZEN, Ward 14)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
