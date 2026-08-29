import type { CategoryRoute, Department, Ward } from "@/generated/prisma";

/// Landmarks that change how dangerous an otherwise ordinary fault is. A dark
/// street outside a school is not the same complaint as a dark street outside
/// a warehouse.
export const LANDMARK_TYPES = [
  "SCHOOL",
  "HOSPITAL",
  "TRANSPORT_HUB",
  "MARKET",
  "GOVERNMENT",
  "RESIDENTIAL",
  "NONE",
] as const;
export type LandmarkType = (typeof LANDMARK_TYPES)[number];

/// Explicit danger cues the classifier is asked to look for, kept as a closed
/// set so the priority engine can score them deterministically.
export const HAZARD_SIGNALS = [
  "EXPOSED_ELECTRICITY",
  "RISK_OF_FALL",
  "FIRE_RISK",
  "DISEASE_RISK",
  "CONTAMINATED_WATER",
  "ROAD_BLOCKED",
  "TRAFFIC_DANGER",
  "CHILDREN_AFFECTED",
  "VULNERABLE_GROUP",
  "STRUCTURAL_COLLAPSE",
] as const;
export type HazardSignal = (typeof HAZARD_SIGNALS)[number];

export const AFFECTED_SCOPES = [
  "INDIVIDUAL",
  "STREET",
  "NEIGHBOURHOOD",
  "WIDE_AREA",
] as const;
export type AffectedScope = (typeof AFFECTED_SCOPES)[number];

export type Classification = {
  categoryKey: string;
  subCategory: string;
  intentSummary: string;
  confidence: number;
  locationText: string | null;
  landmarkType: LandmarkType;
  reportedDurationDays: number | null;
  hazardSignals: HazardSignal[];
  affectedScope: AffectedScope;
  language: string;
  /// "llm" when the model classified it, "keyword" when we fell back to term
  /// matching because the API key was missing or the call failed.
  source: "llm" | "keyword";
};

export type RouteWithDepartment = CategoryRoute & { department: Department };

export type PriorityBreakdown = {
  score: number;
  signals: { label: string; points: number }[];
};

export type IntakeInput = {
  text: string;
  citizenId?: string | null;
  citizenPhone?: string | null;
  locationHint?: string | null;
  lat?: number | null;
  lng?: number | null;
  channel?: string;
  photoUrl?: string | null;
};

export type IntakeTrace = {
  classification: Classification;
  route: RouteWithDepartment | null;
  ward: Ward | null;
  priorityBreakdown: PriorityBreakdown;
  assigneeId: string | null;
  assignmentNote: string;
  slaHours: number;
  dueAt: Date;
};
