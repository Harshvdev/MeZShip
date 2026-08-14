"use client";

import { Radio, MapPin, Loader2, X } from "lucide-react";

interface RadarQueueProps {
  onCancel: () => void;
  statusMessage?: string;
  selectedCampusesCount: number;
}

export function RadarQueue({
  onCancel,
  statusMessage = "Searching for someone nearby...",
  selectedCampusesCount,
}: RadarQueueProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[480px] p-8 text-center animate-fade-in">
      {/* Radar Animation Rings */}
      <div className="relative flex items-center justify-center w-64 h-64 my-6">
        <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-radar-pulse" />
        <div
          className="absolute inset-0 rounded-full border border-indigo-500/30 animate-radar-pulse"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute inset-0 rounded-full border border-purple-500/30 animate-radar-pulse"
          style={{ animationDelay: "2s" }}
        />

        {/* Center Glow Node */}
        <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/50 border border-white/20">
          <Radio className="w-9 h-9 text-white animate-pulse" />
        </div>
      </div>

      <h3 className="text-xl font-semibold text-white mb-2">
        Scanning Selected Campuses
      </h3>
      <p className="text-sm text-gray-400 max-w-sm mb-4">
        {statusMessage}
      </p>

      <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20 mb-8">
        <MapPin className="w-3.5 h-3.5" />
        <span>Searching across {selectedCampusesCount} active campus geofence(s)</span>
      </div>

      <button
        onClick={onCancel}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-colors text-sm font-medium"
      >
        <X className="w-4 h-4" />
        Cancel Search
      </button>
    </div>
  );
}
