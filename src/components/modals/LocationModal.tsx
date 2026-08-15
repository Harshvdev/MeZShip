"use client";

import { useState } from "react";
import {
  X,
  MapPin,
  RefreshCw,
  Sliders,
  RotateCcw,
  Compass,
} from "lucide-react";

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  isCalibrated: boolean;
  locationName: string | null;
  loading: boolean;
  radiusMeters: number;
  onRadiusChange: (radius: number) => void;
  onRetry: () => void;
  onSetLocation: (lat: number, lng: number, label?: string) => void;
  onResetAuto: () => void;
}

const RADIUS_PRESETS = [
  { label: "1 km", value: 1000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "25 km", value: 25000 },
  { label: "50 km", value: 50000 },
];

export function LocationModal({
  isOpen,
  onClose,
  lat,
  lng,
  accuracy,
  isCalibrated,
  locationName,
  loading,
  radiusMeters,
  onRadiusChange,
  onRetry,
  onSetLocation,
  onResetAuto,
}: LocationModalProps) {
  const [customLat, setCustomLat] = useState<string>(lat ? lat.toString() : "");
  const [customLng, setCustomLng] = useState<string>(lng ? lng.toString() : "");
  const [showManualInputs, setShowManualInputs] = useState(false);

  const handleManualSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLat = parseFloat(customLat);
    const parsedLng = parseFloat(customLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      onSetLocation(parsedLat, parsedLng, "Custom Location");
      setShowManualInputs(false);
    }
  };

  if (!isOpen) return null;

  const currentRadiusKm = Math.round(radiusMeters / 1000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl glass-panel border border-white/15 shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">
                Location & Distance Settings
              </h3>
              <p className="text-[11px] text-gray-400">
                Adjust your matchmaking search radius and verify location accuracy
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
          {/* Matchmaking Radius Section */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                <span>Matchmaking Search Radius</span>
              </label>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300">
                {currentRadiusKm} km
              </span>
            </div>

            {/* Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={currentRadiusKm}
                onChange={(e) => onRadiusChange(parseInt(e.target.value, 10) * 1000)}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-teal-400 hover:accent-teal-300 transition-all"
              />
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                <span>1 km (Local)</span>
                <span>25 km (City)</span>
                <span>50 km (Metro)</span>
              </div>
            </div>

            {/* Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {RADIUS_PRESETS.map((p) => {
                const isSelected = radiusMeters === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => onRadiusChange(p.value)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? "bg-teal-500 text-gray-950 border-teal-400 shadow-md shadow-teal-500/20"
                        : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

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
                  {isCalibrated ? "Calibrated Coordinates" : "Detected Coordinates"}
                </span>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                  isCalibrated
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                }`}
              >
                {isCalibrated ? "User Calibrated" : "Auto-detected GPS"}
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

          {/* Manual Input Toggle */}
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowManualInputs(!showManualInputs)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>
                {showManualInputs ? "Hide Custom Coordinates" : "Calibrate Custom Coordinates"}
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
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 focus:border-teal-400 focus:outline-none text-xs text-white"
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
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 focus:border-teal-400 focus:outline-none text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-gray-950 text-xs font-semibold transition-colors shadow-md"
                >
                  Save Calibrated Coordinates
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
