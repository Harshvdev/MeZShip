"use client";

import { useState } from "react";
import { SkipForward, ShieldAlert, UserX, LogOut, MoreVertical } from "lucide-react";

interface ActionBarProps {
  onSkip: () => void;
  onLeave: () => void;
  onOpenReport: () => void;
  onOpenBlock: () => void;
  disabled?: boolean;
}

export function ActionBar({
  onSkip,
  onLeave,
  onOpenReport,
  onOpenBlock,
  disabled = false,
}: ActionBarProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex items-center justify-between p-3 border-t border-white/10 glass-panel relative">
      {/* Primary Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSkip}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/30"
        >
          <SkipForward className="w-4 h-4" />
          <span>Skip</span>
        </button>

        <button
          onClick={onLeave}
          disabled={disabled}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 hover:text-gray-200 border border-white/10 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>

      {/* Safety & Secondary Controls */}
      <div className="relative">
        <button
          onClick={() => setShowMore(!showMore)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-colors"
          title="Safety options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {showMore && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowMore(false)}
            />
            <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl glass-panel border border-white/15 shadow-2xl p-1.5 z-30 animate-fade-in">
              <button
                onClick={() => {
                  setShowMore(false);
                  onOpenReport();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium text-amber-300 hover:bg-amber-500/10 transition-colors"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Report User...</span>
              </button>

              <button
                onClick={() => {
                  setShowMore(false);
                  onOpenBlock();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium text-rose-300 hover:bg-rose-500/10 transition-colors"
              >
                <UserX className="w-4 h-4 text-rose-400" />
                <span>Block User</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
