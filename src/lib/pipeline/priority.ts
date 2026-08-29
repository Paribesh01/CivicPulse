import type { Priority } from "@/generated/prisma";
import type {
  Classification,
  PriorityBreakdown,
  RouteWithDepartment,
} from "./types";

/// Weighted rule engine, per the brief. Every contribution is recorded so an
/// officer can see why one ticket outranks another — a learned ranking model
/// can replace the weights later without changing this interface.

const LANDMARK_POINTS: Record<Classification["landmarkType"], number> = {
  SCHOOL: 18,
  HOSPITAL: 18,
  TRANSPORT_HUB: 12,
  MARKET: 8,
  GOVERNMENT: 6,
  RESIDENTIAL: 2,
  NONE: 0,
};

const SCOPE_POINTS: Record<Classification["affectedScope"], number> = {
  WIDE_AREA: 12,
  NEIGHBOURHOOD: 8,
  STREET: 4,
  INDIVIDUAL: 0,
};

const HAZARD_POINTS = 8;
const HAZARD_CAP = 24;
const REPEAT_POINTS = 4;
const REPEAT_CAP = 12;

export function calculatePriority(
  classification: Classification,
  route: RouteWithDepartment | null,
  repeatCount: number,
): PriorityBreakdown & { priority: Priority } {
  const signals: PriorityBreakdown["signals"] = [];

  const severity = route?.severityWeight ?? 10;
  signals.push({
    label: `Category baseline — ${route?.label ?? "uncategorised"}`,
    points: severity,
  });

  const landmark = LANDMARK_POINTS[classification.landmarkType];
  if (landmark > 0) {
    signals.push({
      label: `Near ${classification.landmarkType.toLowerCase().replace("_", " ")}`,
      points: landmark,
    });
  }

  const hazard = Math.min(
    classification.hazardSignals.length * HAZARD_POINTS,
    HAZARD_CAP,
  );
  if (hazard > 0) {
    signals.push({
      label: `Hazard cues: ${classification.hazardSignals
        .map((h) => h.toLowerCase().replace(/_/g, " "))
        .join(", ")}`,
      points: hazard,
    });
  }

  const days = classification.reportedDurationDays;
  const durationPoints =
    days === null ? 0 : days >= 14 ? 12 : days >= 7 ? 9 : days >= 3 ? 6 : days >= 1 ? 3 : 0;
  if (durationPoints > 0) {
    signals.push({
      label: `Unresolved for ${days} day${days === 1 ? "" : "s"}`,
      points: durationPoints,
    });
  }

  const scope = SCOPE_POINTS[classification.affectedScope];
  if (scope > 0) {
    signals.push({
      label: `Affects ${classification.affectedScope.toLowerCase().replace("_", " ")}`,
      points: scope,
    });
  }

  const repeat = Math.min(repeatCount * REPEAT_POINTS, REPEAT_CAP);
  if (repeat > 0) {
    signals.push({
      label: `${repeatCount} similar open complaint${repeatCount === 1 ? "" : "s"} nearby`,
      points: repeat,
    });
  }

  const score = Math.min(
    signals.reduce((sum, s) => sum + s.points, 0),
    100,
  );

  return { score, signals, priority: toTier(score) };
}

export function toTier(score: number): Priority {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 28) return "MEDIUM";
  return "LOW";
}

/// Urgency compresses the category's own clock rather than replacing it, so a
/// critical road-marking complaint still gets more time than a routine burst
/// water main.
const SLA_MULTIPLIER: Record<Priority, number> = {
  CRITICAL: 0.35,
  HIGH: 0.6,
  MEDIUM: 1,
  LOW: 1.4,
};

const MIN_SLA_HOURS = 2;

export function calculateSlaHours(
  route: RouteWithDepartment | null,
  priority: Priority,
): number {
  const base = route?.baseSlaHours ?? 48;
  return Math.max(MIN_SLA_HOURS, Math.round(base * SLA_MULTIPLIER[priority]));
}
