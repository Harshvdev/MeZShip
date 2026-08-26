"use client";

import {
  X,
  MapPin,
  RefreshCw,
  Sliders,
  Compass,
  AlertTriangle,
} from "lucide-react";

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  locationName: string | null;
  loading: boolean;
  permissionDenied?: boolean;
  radiusMeters: number;
  onRadiusChange: (radius: number) => void;
  onRetry: () => void;
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
  locationName,
  loading,
  permissionDenied = false,
  radiusMeters,
  onRadiusChange,
  onRetry,
}: LocationModalProps) {
  if (!isOpen) return null;

  const currentRadiusKm = Math.round(radiusMeters / 1000);
  const hasCoordinates = lat !== null && lng !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-surface border border-line-bright shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-surface-raised border-b border-line shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-signal/10 border border-signal/30 text-signal flex items-center justify-center">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-paper text-sm sm:text-base leading-tight">
                Search Scope & Location Sensor
              </h3>
              <p className="font-mono text-[10px] text-ash">
                DEVICE GPS · PROXIMITY RADIUS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ash hover:text-paper hover:bg-surface transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Matchmaking Radius Section */}
          <div className="p-3.5 rounded-xl bg-surface-raised border border-line space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-paper font-display flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-signal" />
                <span>Search Scope</span>
              </label>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-signal/10 border border-signal/30 text-signal">
                {currentRadiusKm} km
              </span>
            </div>

            {/* Slider */}
            <div className="space-y-1">
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={currentRadiusKm}
                onChange={(e) => onRadiusChange(parseInt(e.target.value, 10) * 1000)}
                className="w-full h-2 bg-surface rounded appearance-none cursor-pointer accent-signal transition-all"
              />
              <div className="flex items-center justify-between font-mono text-[10px] text-ash px-0.5">
                <span>1 km</span>
                <span>10 km</span>
                <span>25 km</span>
                <span>50 km</span>
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
                    className={`px-2.5 py-1 rounded-md font-mono text-xs font-medium border transition-all ${
                      isSelected
                        ? "bg-signal text-ink border-signal font-bold shadow-sm"
                        : "bg-surface hover:bg-surface-raised border-line text-ash hover:text-paper"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current GPS Coordinates */}
          <div className="p-3.5 rounded-xl bg-surface-raised border border-line space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-paper font-display flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-signal" />
                <span>Hardware Fix</span>
              </span>
              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold bg-surface border border-line text-ash">
                BROWSER SENSOR
              </span>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 font-mono text-xs text-ash py-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-signal" />
                <span>Acquiring satellite constellation & network fix...</span>
              </div>
            ) : hasCoordinates ? (
              <div className="space-y-1.5 font-mono text-xs">
                <div className="p-2 rounded bg-surface border border-line flex items-center justify-between text-paper">
                  <span className="text-ash">LAT / LNG:</span>
                  <span className="font-semibold text-signal">
                    {lat.toFixed(5)}°, {lng.toFixed(5)}°
                  </span>
                </div>
                {accuracy !== null && (
                  <div className="text-[11px] text-ash px-1 flex items-center justify-between">
                    <span>Precision radius:</span>
                    <span className="font-mono text-paper">±{Math.round(accuracy)}m</span>
                  </div>
                )}
                {locationName && (
                  <div className="text-[11px] text-ash px-1 flex items-center justify-between">
                    <span>Sensor Source:</span>
                    <span className="text-paper truncate max-w-[200px]">{locationName}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-alert/10 border border-alert/30 text-alert text-xs space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong className="block font-semibold">Location Permission Required</strong>
                    Location access is required to connect to nearby peers within your chosen radius. Please allow location permissions in your browser.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full py-2 px-3 rounded-lg bg-alert text-ink font-display font-bold text-xs hover:bg-alert/90 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Grant / Retry Location Permission</span>
                </button>
              </div>
            )}

            {/* GPS Controls */}
            {hasCoordinates && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-line text-xs font-mono text-ash hover:text-paper transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Re-poll GPS</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-surface-raised border-t border-line flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-line text-paper font-display text-xs font-semibold transition-colors"
          >
            Confirm & Close
          </button>
        </div>
      </div>
    </div>
  );
}
