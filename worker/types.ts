export interface Env {
  RADAR_MATCHER: DurableObjectNamespace;
  MATCH_ROOM: DurableObjectNamespace;
  CAMPUS_MATCHER?: DurableObjectNamespace;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  SUPABASE_JWKS_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  NEXT_PUBLIC_APP_URL?: string;
  REPORT_THRESHOLD_24H?: string;
  REPORT_THRESHOLD_7D?: string;
  REPORT_THRESHOLD_PERMANENT?: string;
  NODE_ENV?: string;
}

export interface AuthenticatedUser {
  userId: string;
  email?: string;
}

export interface WaitingUser {
  userId: string;
  displayName: string;
  lat: number;
  lng: number;
  maxRadiusMeters: number;
  queuedAt: number;
  campusIds?: string[];
}

export interface GeoJSONPolygon {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}
