"use client";

import { useState, useMemo } from "react";
import { Check, School, MapPin, AlertCircle, Search, X } from "lucide-react";

export interface CampusOption {
  id: string;
  name: string;
  type: string;
  boundary?: any;
  center?: { lat: number; lng: number } | null;
  distanceMeters?: number;
  isInside?: boolean;
}

interface CampusSelectorProps {
  campuses: CampusOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  onCalibrateLocation?: (lat: number, lng: number, label: string) => void;
}

export function CampusSelector({
  campuses,
  selectedIds,
  onChange,
  loading = false,
  onCalibrateLocation,
}: CampusSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const toggleCampus = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        onChange(selectedIds.filter((item) => item !== id));
      }
    } else {
      onChange([...selectedIds, id]);
    }
  };

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

  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return null;
    if (meters < 1000) return `${meters}m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  return (
    <div className="space-y-3">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <label className="text-sm font-medium text-gray-200">
            Where do you want to find people?
          </label>
          <p className="text-[11px] text-gray-400">
            Select one or more campuses to match with nearby students
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
            {selectedIds.length} selected
          </span>
        </div>
      </div>

      {/* Campus Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search campuses by name, acronym (Goel, BBD, IET, IIT), or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8.5 pr-8 py-2 rounded-xl bg-black/30 border border-white/10 focus:border-indigo-500 focus:outline-none text-xs text-white placeholder-gray-500 transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="p-1 rounded-md text-gray-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-8 rounded-2xl border border-white/10 bg-white/5 text-center text-xs text-gray-400 animate-pulse">
          Loading campuses and computing proximity...
        </div>
      ) : filteredCampuses.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-white/10 bg-white/5 text-center space-y-2">
          <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
          <div className="text-xs font-medium text-gray-300">
            {searchQuery
              ? `No campuses matching "${searchQuery}"`
              : "No campuses found"}
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-indigo-400 hover:underline"
            >
              Clear search filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
          {filteredCampuses.map((campus) => {
            const isSelected = selectedIds.includes(campus.id);
            const distText = formatDistance(campus.distanceMeters);

            return (
              <div
                key={campus.id}
                className={`relative flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? "bg-indigo-600/15 border-indigo-500/50 text-white shadow-sm shadow-indigo-500/10"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCampus(campus.id)}
                  className="flex-1 flex items-center gap-3 min-w-0 pr-2 text-left"
                >
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isSelected
                        ? "bg-indigo-500 text-white"
                        : "bg-white/5 text-gray-400"
                    }`}
                  >
                    <School className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold leading-snug line-clamp-2">
                      {campus.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[9px] font-bold tracking-wider text-gray-400 uppercase">
                        {campus.type}
                      </span>
                      {campus.isInside && (
                        <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-500/20 text-emerald-300 font-medium px-1.5 py-0.5 rounded-full">
                          <MapPin className="w-2.5 h-2.5" /> Inside Campus
                        </span>
                      )}
                      {!campus.isInside && distText && (
                        <span className="text-[10px] text-gray-400">
                          • {distText}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  {!campus.isInside && campus.center && onCalibrateLocation && (
                    <button
                      type="button"
                      title={`Set your current location to ${campus.name}`}
                      onClick={() =>
                        onCalibrateLocation(
                          campus.center!.lat,
                          campus.center!.lng,
                          campus.name
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white text-[10px] font-semibold border border-indigo-500/20 transition-all hover:scale-105"
                    >
                      <MapPin className="w-3 h-3 text-indigo-400" />
                      <span>I&apos;m Here</span>
                    </button>
                  )}

                  <button
                    type="button"
                    title="Select campus for matching"
                    onClick={() => toggleCampus(campus.id)}
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-indigo-500 border-indigo-500 text-white shadow-sm"
                        : "border-white/20 bg-white/5"
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
