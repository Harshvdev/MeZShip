import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon, multiPolygon } from "@turf/helpers";
import type { GeoJSONPolygon } from "../types";

/**
 * Checks if coordinates [lng, lat] are inside a GeoJSON Polygon or MultiPolygon
 */
export function isCoordinateInsidePolygon(
  lng: number,
  lat: number,
  boundary: GeoJSONPolygon | any
): boolean {
  try {
    const pt = point([lng, lat]);
    let polyFeature: any;

    if (boundary.type === "Polygon") {
      polyFeature = polygon(boundary.coordinates);
    } else if (boundary.type === "MultiPolygon") {
      polyFeature = multiPolygon(boundary.coordinates);
    } else if (boundary.geometry) {
      return booleanPointInPolygon(pt, boundary);
    } else {
      return false;
    }

    return booleanPointInPolygon(pt, polyFeature);
  } catch (err) {
    console.error("Geofence evaluation error:", err);
    return false;
  }
}

/**
 * Calculates Haversine distance in meters between two lat/lng points
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Computes the approximate center [lat, lng] of a GeoJSON polygon boundary
 */
export function getPolygonCenter(boundary: any): { lat: number; lng: number } | null {
  try {
    let coords: number[][] = [];
    if (boundary?.type === "Polygon" && boundary.coordinates?.[0]) {
      coords = boundary.coordinates[0];
    } else if (boundary?.type === "MultiPolygon" && boundary.coordinates?.[0]?.[0]) {
      coords = boundary.coordinates[0][0];
    }
    if (!coords || coords.length === 0) return null;
    let sumLng = 0;
    let sumLat = 0;
    for (const c of coords) {
      sumLng += c[0];
      sumLat += c[1];
    }
    return {
      lng: sumLng / coords.length,
      lat: sumLat / coords.length,
    };
  } catch {
    return null;
  }
}

