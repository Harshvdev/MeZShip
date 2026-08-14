"use client";

import { useEffect, useState } from "react";

export interface GeoLocationState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocationState>({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocation({
        lat: 37.78,
        lng: -122.41,
        accuracy: 10,
        error: "Geolocation is not supported by your browser. Using default campus demo location.",
        loading: false,
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
        });
      },
      (error) => {
        console.warn("Geolocation permission denied/error, fallback to demo coordinates:", error.message);
        // Provide friendly fallback for local testing
        setLocation({
          lat: 37.78,
          lng: -122.41,
          accuracy: 50,
          error: "Location permission denied. Set to demo campus position.",
          loading: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  useEffect(() => {
    requestLocation();
  }, []);

  return {
    ...location,
    retry: requestLocation,
  };
}
