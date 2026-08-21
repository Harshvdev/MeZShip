/**
 * Formats distance in meters into a human-readable, precise string.
 * Examples:
 * - 0 -> "~0m" or "< 10m"
 * - 5 -> "~5m"
 * - 150 -> "~150m"
 * - 1250 -> "~1.3 km"
 * - 8750 -> "~8.8 km"
 * - 42500 -> "~42.5 km"
 * - undefined / null / negative -> "Nearby"
 */
export function formatDistance(
  meters?: number | null,
  hasPreciseDistance?: boolean
): string {
  if (meters === undefined || meters === null || meters < 0) {
    return "Nearby";
  }

  // If explicitly flagged as fallback / no GPS coordinates
  if (hasPreciseDistance === false && meters === 0) {
    return "Nearby";
  }

  if (meters === 0) {
    return "< 10m";
  }

  if (meters < 1000) {
    return `~${Math.round(meters)}m`;
  }

  const km = meters / 1000;
  // If exact whole number (e.g. 5.0 km), show 1 decimal for consistency
  return `~${km.toFixed(1)} km`;
}
