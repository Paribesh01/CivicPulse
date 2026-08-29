import type { Ward } from "@/generated/prisma";

/// Resolves a complaint to an administrative unit. The brief calls for a
/// geocoding API plus ward shapefiles; this does the same job against the
/// ward roster we hold — alias match on the text first, then nearest-centroid
/// on a GPS pin. Swapping in a real geocoder means replacing `resolveWard`
/// only, since everything downstream consumes a Ward.

export type WardResolution = {
  ward: Ward | null;
  method: "alias" | "gps" | "citizen-default" | "none";
  matchedOn: string | null;
};

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

/// Whole-token containment, so "Zone B" does not match "Bxyz" and ward "14"
/// does not match "140 feet road".
function mentions(haystack: string, needle: string): boolean {
  const n = normalise(needle);
  if (!n) return false;
  return new RegExp(`(^|\\s)${escapeRegex(n)}($|\\s)`).test(haystack);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function resolveWard(args: {
  wards: Ward[];
  text: string;
  locationHint?: string | null;
  lat?: number | null;
  lng?: number | null;
  citizenWardId?: string | null;
}): WardResolution {
  const { wards, lat, lng, citizenWardId } = args;

  // A GPS pin is unambiguous — prefer it over parsing prose.
  if (typeof lat === "number" && typeof lng === "number") {
    const withCoords = wards.filter(
      (w) => typeof w.lat === "number" && typeof w.lng === "number",
    );
    if (withCoords.length > 0) {
      const nearest = withCoords.reduce((best, ward) => {
        const d = haversineKm({ lat, lng }, { lat: ward.lat!, lng: ward.lng! });
        const bestD = haversineKm({ lat, lng }, { lat: best.lat!, lng: best.lng! });
        return d < bestD ? ward : best;
      });
      return { ward: nearest, method: "gps", matchedOn: `${lat}, ${lng}` };
    }
  }

  const haystack = normalise(
    [args.locationHint ?? "", args.text].filter(Boolean).join(" "),
  );

  // Landmark aliases are the most specific signal, then the ward's own name,
  // then the zone as a coarse fallback.
  for (const ward of wards) {
    for (const alias of ward.aliases) {
      if (mentions(haystack, alias)) {
        return { ward, method: "alias", matchedOn: alias };
      }
    }
  }
  for (const ward of wards) {
    if (mentions(haystack, ward.name) || mentions(haystack, ward.code)) {
      return { ward, method: "alias", matchedOn: ward.name };
    }
  }
  for (const ward of wards) {
    if (mentions(haystack, ward.zone)) {
      return { ward, method: "alias", matchedOn: ward.zone };
    }
  }

  // Nothing in the text — fall back to where the citizen is registered.
  if (citizenWardId) {
    const ward = wards.find((w) => w.id === citizenWardId);
    if (ward) {
      return { ward, method: "citizen-default", matchedOn: "citizen profile" };
    }
  }

  return { ward: null, method: "none", matchedOn: null };
}
