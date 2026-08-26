"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Radio, X, MapPin } from "lucide-react";
import { formatDistance } from "@/lib/distance";

interface RadarDialProps {
  radiusKm: number;
  onRadiusChange: (km: number) => void;
  state: "IDLE" | "SEARCHING" | "MATCHED" | "PARTNER_SKIPPED" | "ERROR";
  onStartMatching?: () => void;
  onCancelSearch?: () => void;
  partnerDistanceMeters?: number;
  hasPreciseDistance?: boolean;
  partnerDisplayName?: string;
  disabled?: boolean;
}

// Preset snap points
const SNAP_POINTS = [1, 5, 10, 25, 50];

// Range rings visual mapping (px in 360x360 SVG box)
// Center is (180, 180), max radius is 150
const RING_PRESETS = [
  { km: 1, px: 38 },
  { km: 10, px: 76 },
  { km: 25, px: 114 },
  { km: 50, px: 152 },
];

function kmToPx(km: number): number {
  if (km <= 1) return 38;
  if (km <= 10) return 38 + ((km - 1) / 9) * (76 - 38);
  if (km <= 25) return 76 + ((km - 10) / 15) * (114 - 76);
  return 114 + ((km - 25) / 25) * (152 - 114);
}

function pxToKm(px: number): number {
  if (px <= 38) return 1;
  if (px <= 76) {
    const raw = 1 + ((px - 38) / (76 - 38)) * 9;
    return Math.round(raw);
  }
  if (px <= 114) {
    const raw = 10 + ((px - 76) / (114 - 76)) * 15;
    return Math.round(raw);
  }
  const raw = 25 + ((px - 114) / (152 - 114)) * 25;
  return Math.min(50, Math.max(1, Math.round(raw)));
}

export function RadarDial({
  radiusKm,
  onRadiusChange,
  state,
  onCancelSearch,
  partnerDistanceMeters,
  hasPreciseDistance,
  disabled = false,
}: RadarDialProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [dragAngle, setDragAngle] = useState(45); // default handle angle top-right

  // Search Timer
  useEffect(() => {
    if (state !== "SEARCHING") {
      setSearchSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  const activePxRadius = kmToPx(radiusKm);

  // Convert client pointer coordinate to SVG radius and angle
  const handlePointerCoord = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;

      const dist = Math.sqrt(dx * dx + dy * dy);
      const svgScale = 180 / (rect.width / 2);
      const pxDist = dist * svgScale;

      let rawKm = pxToKm(pxDist);

      // Check snap points (within ±1.2km)
      for (const snap of SNAP_POINTS) {
        if (Math.abs(rawKm - snap) <= 1.4) {
          rawKm = snap;
          break;
        }
      }

      const clampedKm = Math.min(50, Math.max(1, rawKm));
      onRadiusChange(clampedKm);

      // Calculate angle for handle position
      const rad = Math.atan2(dy, dx);
      let deg = (rad * 180) / Math.PI;
      if (deg < 0) deg += 360;
      setDragAngle(deg);
    },
    [onRadiusChange]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || state === "SEARCHING" || state === "MATCHED") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    handlePointerCoord(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handlePointerCoord(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {}
    }
  };

  // Keyboard navigation for hidden range input
  const handleRangeKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      onRadiusChange(val);
    }
  };

  // Handle position in SVG coords
  const handleRad = (dragAngle * Math.PI) / 180;
  const handleX = 180 + activePxRadius * Math.cos(handleRad);
  const handleY = 180 + activePxRadius * Math.sin(handleRad);

  // Format search timer e.g. "00:12"
  const mins = Math.floor(searchSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (searchSeconds % 60).toString().padStart(2, "0");

  const isSearching = state === "SEARCHING";
  const isMatched = state === "MATCHED";

  return (
    <div className="flex flex-col items-center justify-center w-full select-none">
      {/* Visually hidden native range input for accessibility */}
      <input
        type="range"
        min="1"
        max="50"
        step="1"
        value={radiusKm}
        onChange={handleRangeKey}
        disabled={disabled || isSearching}
        aria-label="Search radius distance in kilometers"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:p-2 focus:bg-surface focus:text-signal focus:rounded focus:border focus:border-signal"
      />

      {/* Main Radar Instrument Box */}
      <div className="relative w-full max-w-[240px] xs:max-w-[270px] sm:max-w-[340px] lg:max-w-[380px] aspect-square flex items-center justify-center p-1 sm:p-2 shrink-0">
        <svg
          ref={svgRef}
          viewBox="0 0 360 360"
          className={`w-full h-full overflow-visible touch-none ${
            !isSearching && !isMatched ? "cursor-crosshair" : "cursor-default"
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            {/* Radar Sweep Gradients */}
            <linearGradient id="sweepIdle" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#3ECF8E" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sweepActive" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.65" />
              <stop offset="40%" stopColor="#3ECF8E" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="signalDisc" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.16" />
              <stop offset="85%" stopColor="#3ECF8E" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0.03" />
            </radialGradient>
            <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3ECF8E" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#3ECF8E" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer Compass Outer Ring */}
          <circle
            cx="180"
            cy="180"
            r="168"
            fill="none"
            stroke="rgba(233, 242, 236, 0.05)"
            strokeWidth="1"
          />

          {/* Crosshair Axes & Bearing Markings */}
          <line
            x1="180"
            y1="12"
            x2="180"
            y2="348"
            stroke="rgba(233, 242, 236, 0.06)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
          <line
            x1="12"
            y1="180"
            x2="348"
            y2="180"
            stroke="rgba(233, 242, 236, 0.06)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />

          {/* Compass cardinal ticks */}
          <text
            x="180"
            y="24"
            textAnchor="middle"
            fill="#7C8A83"
            className="font-mono text-[9px] font-semibold select-none"
          >
            000°
          </text>
          <text
            x="344"
            y="183"
            textAnchor="end"
            fill="#7C8A83"
            className="font-mono text-[9px] font-semibold select-none"
          >
            090°
          </text>
          <text
            x="180"
            y="344"
            textAnchor="middle"
            fill="#7C8A83"
            className="font-mono text-[9px] font-semibold select-none"
          >
            180°
          </text>
          <text
            x="16"
            y="183"
            textAnchor="start"
            fill="#7C8A83"
            className="font-mono text-[9px] font-semibold select-none"
          >
            270°
          </text>

          {/* 4 Concentric Distance Rings: 1km, 10km, 25km, 50km */}
          {RING_PRESETS.map((ring) => (
            <g key={ring.km}>
              <circle
                cx="180"
                cy="180"
                r={ring.px}
                fill="none"
                stroke="#1E4A38"
                strokeWidth="1"
                strokeDasharray={ring.km === 50 ? "none" : "3 3"}
              />
              {/* Range label along 045° bearing */}
              <text
                x={180 + ring.px * Math.cos((-45 * Math.PI) / 180) + 3}
                y={180 + ring.px * Math.sin((-45 * Math.PI) / 180) - 3}
                fill="#7C8A83"
                className="font-mono text-[9px] font-medium select-none pointer-events-none"
              >
                {ring.km}km
              </text>
            </g>
          ))}

          {/* Translucent --signal Active Disc */}
          <circle
            cx="180"
            cy="180"
            r={activePxRadius}
            fill="url(#signalDisc)"
            stroke="#3ECF8E"
            strokeWidth="1.75"
            className="transition-[r] duration-75 ease-out"
          />

          {/* Wide Invisible Touch Perimeter Hit Target (at least 44px wide) */}
          {!isSearching && (
            <circle
              cx="180"
              cy="180"
              r={activePxRadius}
              fill="none"
              stroke="transparent"
              strokeWidth="48"
              className="cursor-ew-resize"
            />
          )}

          {/* Live Radar Sweep Line */}
          <g
            className={`origin-[180px_180px] pointer-events-none ${
              isSearching ? "animate-sweep-searching" : "animate-sweep-idle"
            }`}
          >
            {/* Sweep cone sector */}
            <path
              d={`M 180 180 L 180 28 A 152 152 0 0 1 287 72 Z`}
              fill={isSearching ? "url(#sweepActive)" : "url(#sweepIdle)"}
            />
            {/* Leading beam line */}
            <line
              x1="180"
              y1="180"
              x2="180"
              y2="28"
              stroke="#3ECF8E"
              strokeWidth={isSearching ? "2" : "1.2"}
              strokeOpacity={isSearching ? "0.9" : "0.5"}
              strokeDasharray={isSearching ? "none" : "2 2"}
            />
          </g>

          {/* Center Emitter Dot ("You") */}
          <g className="origin-[180px_180px] pointer-events-none">
            <circle
              cx="180"
              cy="180"
              r="14"
              fill="url(#centerGlow)"
              className="animate-pulse-center"
            />
            <circle
              cx="180"
              cy="180"
              r="4.5"
              fill="#3ECF8E"
              stroke="#0A0F0D"
              strokeWidth="1.5"
            />
          </g>

          {/* Draggable Outer Handle on Ring Edge */}
          {!isSearching && (
            <g
              transform={`translate(${handleX}, ${handleY})`}
              className="cursor-grab active:cursor-grabbing"
            >
              {/* Pulsing ring around handle on hover / drag */}
              <circle
                r="16"
                fill="rgba(62, 207, 142, 0.15)"
                stroke="#3ECF8E"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                r="6"
                fill="#3ECF8E"
                stroke="#0A0F0D"
                strokeWidth="2"
                className="drop-shadow-md transition-transform duration-100 group-hover:scale-125"
              />
            </g>
          )}

          {/* Matched Partner Blip (Alert Color #FFB238) */}
          {isMatched && (
            <g
              transform="translate(235, 135)"
              className="origin-center pointer-events-none"
            >
              <circle
                r="18"
                fill="none"
                stroke="#FFB238"
                strokeWidth="1.5"
                className="animate-alert-blip"
              />
              <circle
                r="5"
                fill="#FFB238"
                stroke="#0A0F0D"
                strokeWidth="1.5"
              />
              <text
                x="10"
                y="-6"
                fill="#FFB238"
                className="font-mono text-[10px] font-bold"
              >
                {formatDistance(partnerDistanceMeters, hasPreciseDistance)}
              </text>
            </g>
          )}
        </svg>

        {/* Floating Mono Drag Tooltip Following Ring */}
        {isDragging && !isSearching && (
          <div
            className="absolute pointer-events-none font-mono text-xs font-bold text-ink bg-signal px-2.5 py-0.5 rounded shadow-lg transition-transform"
            style={{
              left: `${(handleX / 360) * 100}%`,
              top: `${(handleY / 360) * 100}%`,
              transform: "translate(-50%, -140%)",
            }}
          >
            {radiusKm} km
          </div>
        )}
      </div>

      {/* Radar Readout & Status Deck */}
      <div className="w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[400px] flex flex-col items-center text-center mt-1.5 sm:mt-2">
        {isSearching ? (
          <div className="flex flex-col items-center gap-1.5 animate-fade-in w-full">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-signal/10 border border-signal/30 text-signal font-mono text-xs font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-signal animate-ping" />
              <span>Searching · {mins}:{secs}</span>
            </div>

            {/* Quiet empty-state caption after 10 seconds */}
            {searchSeconds >= 10 && (
              <p className="font-mono text-[11px] sm:text-xs text-ash animate-fade-in px-2">
                No signal yet — try widening your radius.
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full px-3 py-1 rounded-full bg-surface border border-line text-xs font-mono text-ash shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-signal shrink-0" />
            <span className="text-paper font-semibold">{radiusKm} km</span>
            <span className="text-ash/70 text-[11px]">· Drag handle to set scope</span>
          </div>
        )}
      </div>
    </div>
  );
}
