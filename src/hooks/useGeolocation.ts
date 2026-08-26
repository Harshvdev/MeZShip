"use client";

import { useEffect, useState, useCallback } from "react";

export interface GeoLocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  permissionDenied: boolean;
  locationName: string | null;
}

const CACHED_AUTO_KEY = "mezship_cached_auto_location";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const initialLocationState: GeoLocationState = {
  lat: null,
  lng: null,
  accuracy: null,
  error: null,
  loading: true,
  permissionDenied: false,
  locationName: null,
};

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocationState>(initialLocationState);

  const requestBrowserLocation = useCallback((forceFresh = false) => {
    if (typeof window === "undefined") return;

    if (!navigator.geolocation) {
      setLocation({
        lat: null,
        lng: null,
        accuracy: null,
        error: "Geolocation is not supported by your browser.",
        loading: false,
        permissionDenied: true,
        locationName: null,
      });
      return;
    }

    setLocation((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        try {
          sessionStorage.setItem(
            CACHED_AUTO_KEY,
            JSON.stringify({
              lat,
              lng,
              accuracy,
              timestamp: Date.now(),
            })
          );
        } catch {}

        setLocation({
          lat,
          lng,
          accuracy,
          error: null,
          loading: false,
          permissionDenied: false,
          locationName: "Auto-detected GPS / Network",
        });
      },
      (error) => {
        console.warn("Geolocation permission error/denied:", error.message);
        setLocation({
          lat: null,
          lng: null,
          accuracy: null,
          error: "Location permission is required to connect to nearby people.",
          loading: false,
          permissionDenied: true,
          locationName: null,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: forceFresh ? 0 : 30000,
      }
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check recently cached auto-detected location from session
    try {
      const cached = sessionStorage.getItem(CACHED_AUTO_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          typeof parsed.lat === "number" &&
          typeof parsed.lng === "number" &&
          Date.now() - (parsed.timestamp || 0) < CACHE_TTL_MS
        ) {
          setLocation({
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy || 15,
            error: null,
            loading: false,
            permissionDenied: false,
            locationName: "Auto-detected GPS / Network",
          });
        }
      }
    } catch {}

    requestBrowserLocation();
  }, [requestBrowserLocation]);

  return {
    ...location,
    retry: () => requestBrowserLocation(true),
  };
}
