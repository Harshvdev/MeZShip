"use client";

import { Check, School, MapPin, AlertCircle } from "lucide-react";

export interface CampusOption {
  id: string;
  name: string;
  type: string;
  distanceMeters?: number;
  isInside?: boolean;
}

interface CampusSelectorProps {
  campuses: CampusOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}

export function CampusSelector({
  campuses,
  selectedIds,
  onChange,
  loading = false,
}: CampusSelectorProps) {
  const toggleCampus = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length > 1) {
        onChange(selectedIds.filter((item) => item !== id));
      }
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return null;
    if (meters < 1000) return `${meters}m away`;
    return `${(meters / 1000).toFixed(1)} km away`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">
          Where do you want to find people?
        </label>
        <span className="text-xs text-gray-500">
          {selectedIds.length} selected
        </span>
      </div>

      {loading ? (
        <div className="p-6 rounded-xl border border-white/10 bg-white/5 text-center text-sm text-gray-400">
          Loading campuses near you...
        </div>
      ) : campuses.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-white/10 bg-white/5 text-center space-y-2">
          <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
          <div className="text-sm font-medium text-gray-300">No campuses found nearby</div>
          <div className="text-xs text-gray-500">
            No registered university or college campuses found within your vicinity. Make sure location permissions are enabled.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {campuses.map((campus) => {
            const isSelected = selectedIds.includes(campus.id);
            const distText = formatDistance(campus.distanceMeters);

            return (
              <button
                key={campus.id}
                type="button"
                onClick={() => toggleCampus(campus.id)}
                className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-indigo-600/15 border-indigo-500/50 text-white shadow-sm shadow-indigo-500/10"
                    : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isSelected
                        ? "bg-indigo-500 text-white"
                        : "bg-white/5 text-gray-400"
                    }`}
                  >
                    <School className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium leading-tight">{campus.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                        {campus.type}
                      </span>
                      {campus.isInside && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 font-medium px-1.5 py-0.5 rounded-full">
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
                </div>

                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? "bg-indigo-500 border-indigo-500 text-white"
                      : "border-white/20 bg-white/5"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

