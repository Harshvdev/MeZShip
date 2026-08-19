/**
 * Utility functions for formatting values across the UI
 */

/**
 * Formats a distance in meters to a clean, human-readable string.
 * Examples:
 * - null / undefined / <0 -> "Nearby"
 * - 4 -> "< 10m"
 * - 45 -> "~45m"
 * - 850 -> "~850m"
 * - 1200 -> "~1.2 km"
 * - 15400 -> "~15.4 km"
 */
export function formatDistance(distanceMeters?: number | null): string {
  if (
    distanceMeters === undefined ||
    distanceMeters === null ||
    isNaN(distanceMeters) ||
    distanceMeters < 0
  ) {
    return "Nearby";
  }

  if (distanceMeters < 10) {
    return "< 10m";
  }

  if (distanceMeters < 1000) {
    return `~${Math.round(distanceMeters)}m`;
  }

  const km = distanceMeters / 1000;
  if (km < 10) {
    return `~${km.toFixed(1)} km`;
  }

  return `~${Math.round(km)} km`;
}
