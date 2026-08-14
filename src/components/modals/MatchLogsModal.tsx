"use client";

import { useState, useEffect } from "react";
import { X, Clock, ShieldAlert, Ban, Check, Trash2, School, MessageSquare } from "lucide-react";
import { getMatchLogs, clearMatchLogs, type MatchLogEntry } from "@/lib/matchLogs";

interface MatchLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReportForPastMatch: (matchId: string, reportedUserId: string, displayName: string) => void;
  onBlockUser: (targetUserId: string, displayName: string) => Promise<boolean>;
}

export function MatchLogsModal({
  isOpen,
  onClose,
  onOpenReportForPastMatch,
  onBlockUser,
}: MatchLogsModalProps) {
  const [logs, setLogs] = useState<MatchLogEntry[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockingId, setBlockingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLogs(getMatchLogs());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    clearMatchLogs();
    setLogs([]);
  };

  const handleBlock = async (userId: string, name: string) => {
    setBlockingId(userId);
    const success = await onBlockUser(userId, name);
    if (success) {
      setBlockedUserIds((prev) => [...prev, userId]);
    }
    setBlockingId(null);
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return "1d ago";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel border border-white/10 p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Recent Chats</h3>
              <p className="text-xs text-gray-400">
                Chat connections from the last 24 hours (auto-cleared)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[220px]">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-6 space-y-2">
              <MessageSquare className="w-8 h-8 text-gray-600" />
              <div className="text-sm font-medium text-gray-300">No Recent Chats</div>
              <p className="text-xs text-gray-500 max-w-xs">
                Your connections from the last 24 hours will appear here so you can review or report past interactions.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isBlocked = blockedUserIds.includes(log.partnerUserId);

              return (
                <div
                  key={log.matchId}
                  className="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md shrink-0">
                      {log.partnerDisplayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                        <span>{log.partnerDisplayName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/5">
                          {formatTimeAgo(log.matchedAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span className="truncate flex items-center gap-1">
                          <School className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>{log.campusId}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {/* Report Button */}
                    <button
                      type="button"
                      disabled={log.reported}
                      onClick={() =>
                        onOpenReportForPastMatch(
                          log.matchId,
                          log.partnerUserId,
                          log.partnerDisplayName
                        )
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        log.reported
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-default"
                          : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20"
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{log.reported ? "Reported" : "Report"}</span>
                    </button>

                    {/* Block Button */}
                    <button
                      type="button"
                      disabled={isBlocked || blockingId === log.partnerUserId}
                      onClick={() => handleBlock(log.partnerUserId, log.partnerDisplayName)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        isBlocked
                          ? "bg-gray-800 text-gray-400 border border-gray-700 cursor-default"
                          : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:text-white"
                      }`}
                    >
                      {isBlocked ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Blocked</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-3.5 h-3.5" />
                          <span>Block</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {logs.length > 0 && (
          <div className="pt-3 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
            <span className="text-[11px] text-gray-500">
              {logs.length} connection{logs.length === 1 ? "" : "s"} logged
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
