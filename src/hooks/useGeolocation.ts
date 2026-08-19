"use client";

import { useEffect, useState, useCallback } from "react";

export interface GeoLocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  isCalibrated: boolean;
  locationName: string | null;
}

const STORAGE_KEY = "mezship_calibrated_location";

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    loading: true,
    isCalibrated: false,
    locationName: null,
  });

  const requestBrowserLocation = useCallback((forceFresh = false) => {
    if (typeof window === "undefined") return;

    if (!navigator.geolocation) {
      setLocation({
        lat: null,
        lng: null,
        accuracy: null,
        error: "Geolocation is not supported by your browser.",
        loading: false,
        isCalibrated: false,
        locationName: null,
      });
      return;
    }

    setLocation((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
          isCalibrated: false,
          locationName: "Auto-detected GPS / Network",
        });
      },
      (error) => {
        console.warn("Geolocation permission error/denied:", error.message);
        setLocation((prev) => ({
          ...prev,
          error: "Location access denied or unavailable. You can set custom coordinates in Location Settings.",
          loading: false,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: forceFresh ? 0 : 30000,
      }
    );
  }, []);

  const setCalibratedLocation = useCallback(
    (lat: number, lng: number, locationName?: string) => {
      const cleanName = locationName || "Calibrated Location";
      const payload = {
        lat,
        lng,
        locationName: cleanName,
        timestamp: Date.now(),
      };
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
          console.error("Failed to save calibrated location:", e);
        }
      }

      setLocation({
        lat,
        lng,
        accuracy: 10,
        error: null,
        loading: false,
        isCalibrated: true,
        locationName: cleanName,
      });
    },
    []
  );

  const resetToAuto = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error("Failed to clear calibrated location:", e);
      }
    }
    requestBrowserLocation(true);
  }, [requestBrowserLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if user previously calibrated their location (e.g. for desktop IP fixes)
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.lat === "number" &&
          !isNaN(parsed.lat) &&
          typeof parsed.lng === "number" &&
          !isNaN(parsed.lng)
        ) {
          // Clean legacy campus / college names if present in localStorage
          let cleanName = parsed.locationName || "Calibrated Location";
          if (
            typeof cleanName === "string" &&
            (cleanName.toLowerCase().includes("campus") ||
              cleanName.toLowerCase().includes("institute") ||
              cleanName.toLowerCase().includes("college") ||
              cleanName.toLowerCase().includes("university"))
          ) {
            cleanName = "Calibrated Location";
          }

          setLocation({
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: 10,
            error: null,
            loading: false,
            isCalibrated: true,
            locationName: cleanName,
          });
          return;
        }
      }
    } catch (e) {
      console.warn("Error reading calibrated location:", e);
    }

    requestBrowserLocation();
  }, [requestBrowserLocation]);

  return {
    ...location,
    retry: () => requestBrowserLocation(true),
    setCalibratedLocation,
    resetToAuto,
  };
}
