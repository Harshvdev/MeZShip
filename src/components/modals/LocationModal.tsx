"use client";

import { useState, useMemo } from "react";
import {
  X,
  MapPin,
  RefreshCw,
  Search,
  Check,
  Compass,
  Building2,
  Sliders,
  RotateCcw,
} from "lucide-react";
import type { CampusOption } from "@/components/matching/CampusSelector";

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  isCalibrated: boolean;
  locationName: string | null;
  loading: boolean;
  onRetry: () => void;
  onSetLocation: (lat: number, lng: number, label?: string) => void;
  onResetAuto: () => void;
  campuses: CampusOption[];
}

export function LocationModal({
  isOpen,
  onClose,
  lat,
  lng,
  accuracy,
  isCalibrated,
  locationName,
  loading,
  onRetry,
  onSetLocation,
  onResetAuto,
  campuses,
}: LocationModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customLat, setCustomLat] = useState<string>(lat ? lat.toString() : "");
  const [customLng, setCustomLng] = useState<string>(lng ? lng.toString() : "");
  const [showManualInputs, setShowManualInputs] = useState(false);

  const filteredCampuses = useMemo(() => {
    if (!searchQuery.trim()) return campuses;
    const q = searchQuery.toLowerCase();
    return campuses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q)
    );
  }, [campuses, searchQuery]);

  const handleSelectCampus = (campus: CampusOption) => {
    if (campus.center) {
      onSetLocation(campus.center.lat, campus.center.lng, campus.name);
      onClose();
    }
  };

  const handleManualSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(customLat);
    const parsedLng = parseFloat(customLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      onSetLocation(parsedLat, parsedLng, "Custom Coordinates");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl glass-panel border border-white/15 shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                Location & Campus Proximity
              </h3>
              <p className="text-[11px] text-gray-400">
                Ensure accurate proximity to match with students on your campus
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Current Status Card */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    lat && lng
                      ? isCalibrated
                        ? "bg-amber-400 animate-pulse"
                        : "bg-emerald-400"
                      : "bg-rose-400"
                  }`}
                />
                <span className="text-xs font-semibold text-white">
                  {isCalibrated ? "Calibrated Campus Location" : "Detected Coordinates"}
                </span>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  isCalibrated
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                }`}
              >
                {isCalibrated ? "User Calibrated" : "Auto-detected"}
              </span>
            </div>

            <div className="text-xs text-gray-300 font-mono bg-black/30 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
              <span>
                {lat && lng
                  ? `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`
                  : "No coordinates available"}
              </span>
              {accuracy && (
                <span className="text-[10px] text-gray-500 font-sans">
                  ±{Math.round(accuracy)}m
                </span>
              )}
            </div>

            {/* Re-detect & Reset actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onRetry}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>{loading ? "Detecting GPS..." : "Re-detect GPS/Network"}</span>
              </button>

              {isCalibrated && (
                <button
                  type="button"
                  onClick={onResetAuto}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-medium text-rose-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Auto</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Campus Search & Calibrate */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Calibrate Location to Your Campus</span>
              </label>
              <span className="text-[11px] text-gray-400">
                Fixes ISP/Network routing errors
              </span>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search colleges (e.g. Goel, BBD, IET, Lucknow, Kanpur)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:outline-none text-xs text-white placeholder-gray-500 transition-colors"
              />
            </div>

            {/* Campus List */}
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {filteredCampuses.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500 rounded-xl bg-white/5">
                  No campuses match &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredCampuses.map((campus) => {
                  const dist =
                    campus.distanceMeters !== undefined
                      ? campus.distanceMeters < 1000
                        ? `${campus.distanceMeters}m`
                        : `${(campus.distanceMeters / 1000).toFixed(1)} km`
                      : null;

                  return (
                    <div
                      key={campus.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        campus.isInside
                          ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                          : "bg-white/5 border-white/10 text-gray-300 hover:border-white/20"
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="text-xs font-medium truncate">{campus.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                            {campus.type}
                          </span>
                          {campus.isInside && (
                            <span className="text-[10px] text-emerald-400 font-medium">
                              • Inside Campus
                            </span>
                          )}
                          {!campus.isInside && dist && (
                            <span className="text-[10px] text-gray-400">• {dist} away</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectCampus(campus)}
                        disabled={!campus.center}
                        className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          campus.isInside
                            ? "bg-emerald-500 text-white shadow-sm"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                        }`}
                      >
                        {campus.isInside ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Current</span>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-3 h-3" />
                            <span>I&apos;m Here</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Manual Input Toggle */}
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowManualInputs(!showManualInputs)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>
                {showManualInputs ? "Hide Custom Coordinates" : "Enter Custom Coordinates"}
              </span>
            </button>

            {showManualInputs && (
              <form onSubmit={handleManualSave} className="mt-3 space-y-3 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 26.8915"
                      value={customLat}
                      onChange={(e) => setCustomLat(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:outline-none text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 81.0710"
                      value={customLng}
                      onChange={(e) => setCustomLng(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:outline-none text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
                >
                  Save Custom Coordinates
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
