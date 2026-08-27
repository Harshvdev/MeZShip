"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getApiUrl } from "@/lib/api";

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
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

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
  const isAcquiringRef = useRef(false);
  const lastAcquiredTimeRef = useRef<number>(0);

  const saveToCache = (lat: number, lng: number, accuracy: number | null, locationName: string) => {
    try {
      sessionStorage.setItem(
        CACHED_AUTO_KEY,
        JSON.stringify({
          lat,
          lng,
          accuracy,
          locationName,
          timestamp: Date.now(),
        })
      );
    } catch {}
  };

  const fetchIpFallback = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl("/api/location/ip"));
      if (res.ok) {
        const data = (await res.json()) as {
          lat?: number | null;
          lng?: number | null;
          accuracy?: number | null;
          locationName?: string | null;
        };

        if (
          typeof data.lat === "number" &&
          typeof data.lng === "number" &&
          Number.isFinite(data.lat) &&
          Number.isFinite(data.lng)
        ) {
          const locName = data.locationName || "Approximate Edge IP Location";
          saveToCache(data.lat, data.lng, data.accuracy || 10000, locName);
          lastAcquiredTimeRef.current = Date.now();
          setLocation({
            lat: data.lat,
            lng: data.lng,
            accuracy: data.accuracy || 10000,
            error: null,
            loading: false,
            permissionDenied: false,
            locationName: locName,
          });
          return true;
        }
      }
    } catch (e) {
      console.warn("IP Geolocation fallback failed:", e);
    }
    return false;
  }, []);

  const requestBrowserLocation = useCallback(
    (forceFresh = false) => {
      if (typeof window === "undefined") return;
      if (isAcquiringRef.current && !forceFresh) return;

      isAcquiringRef.current = true;
      setLocation((prev) => ({ ...prev, loading: true, error: null }));

      const handleSuccess = (position: GeolocationPosition, sourceName: string) => {
        isAcquiringRef.current = false;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        saveToCache(lat, lng, accuracy, sourceName);
        lastAcquiredTimeRef.current = Date.now();

        setLocation({
          lat,
          lng,
          accuracy,
          error: null,
          loading: false,
          permissionDenied: false,
          locationName: sourceName,
        });
      };

      if (!navigator.geolocation) {
        // Device/browser lacks navigator.geolocation API -> Fallback directly to Edge IP
        fetchIpFallback().then((success) => {
          isAcquiringRef.current = false;
          if (!success) {
            setLocation({
              lat: null,
              lng: null,
              accuracy: null,
              error: "Geolocation is not supported by your browser.",
              loading: false,
              permissionDenied: false,
              locationName: null,
            });
          }
        });
        return;
      }

      // Tier 1: Try High Accuracy GPS / Sensor (6s probe)
      navigator.geolocation.getCurrentPosition(
        (pos) => handleSuccess(pos, "GPS / High-Accuracy Sensor"),
        (err) => {
          // Explicit permission denied by user (code 1)
          if (err.code === 1 /* PERMISSION_DENIED */) {
            isAcquiringRef.current = false;
            console.warn("Geolocation permission explicitly denied:", err.message);
            setLocation({
              lat: null,
              lng: null,
              accuracy: null,
              error: "Location permission is required to connect to nearby people.",
              loading: false,
              permissionDenied: true,
              locationName: null,
            });
            return;
          }

          // Tier 2 Fallback: High accuracy failed/timed out (code 2/3) -> Try standard network/Wi-Fi fix
          console.warn("High-accuracy sensor unavailable/timeout, falling back to standard network fix...", err.message);
          navigator.geolocation.getCurrentPosition(
            (pos2) => handleSuccess(pos2, "Network / Wi-Fi Geolocation"),
            async (err2) => {
              if (err2.code === 1 /* PERMISSION_DENIED */) {
                isAcquiringRef.current = false;
                setLocation({
                  lat: null,
                  lng: null,
                  accuracy: null,
                  error: "Location permission is required to connect to nearby people.",
                  loading: false,
                  permissionDenied: true,
                  locationName: null,
                });
                return;
              }

              // Tier 3 Fallback: Browser geolocation unavailable -> Fallback to Cloudflare Edge IP
              console.warn("Browser geolocation unavailable, attempting Cloudflare Edge IP fallback...", err2.message);
              const ipSuccess = await fetchIpFallback();
              isAcquiringRef.current = false;

              if (!ipSuccess) {
                setLocation({
                  lat: null,
                  lng: null,
                  accuracy: null,
                  error: "Unable to acquire location fix. Please check permissions or network connection.",
                  loading: false,
                  permissionDenied: false,
                  locationName: null,
                });
              }
            },
            {
              enableHighAccuracy: false,
              timeout: 10000,
              maximumAge: forceFresh ? 0 : 300000, // 5 min cache
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: forceFresh ? 0 : 30000,
        }
      );
    },
    [fetchIpFallback]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Check recently cached auto-detected location from session
    try {
      const cached = sessionStorage.getItem(CACHED_AUTO_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          typeof parsed.lat === "number" &&
          typeof parsed.lng === "number" &&
          Date.now() - (parsed.timestamp || 0) < CACHE_TTL_MS
        ) {
          lastAcquiredTimeRef.current = parsed.timestamp;
          setLocation({
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: parsed.accuracy || 15,
            error: null,
            loading: false,
            permissionDenied: false,
            locationName: parsed.locationName || "Cached Location",
          });
        }
      }
    } catch {}

    // 2. Initial acquisition
    requestBrowserLocation();

    // 3. Tab visibility listener: Refresh location if foregrounded after 15+ minutes
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (Date.now() - lastAcquiredTimeRef.current > 15 * 60 * 1000) {
          requestBrowserLocation();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [requestBrowserLocation]);

  return {
    ...location,
    retry: () => requestBrowserLocation(true),
  };
}
