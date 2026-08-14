"use client";

import { Check, School, ShieldCheck } from "lucide-react";

export interface CampusOption {
  id: string;
  name: string;
  type: string;
}

interface CampusSelectorProps {
  campuses: CampusOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function CampusSelector({
  campuses,
  selectedIds,
  onChange,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {campuses.map((campus) => {
          const isSelected = selectedIds.includes(campus.id);
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
                  className={`p-2 rounded-lg ${
                    isSelected
                      ? "bg-indigo-500 text-white"
                      : "bg-white/5 text-gray-400"
                  }`}
                >
                  <School className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{campus.name}</div>
                  <div className="text-xs text-gray-500">{campus.type}</div>
                </div>
              </div>

              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
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
    </div>
  );
}
