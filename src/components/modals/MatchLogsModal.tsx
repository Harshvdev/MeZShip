"use client";

import { useState, useEffect } from "react";
import { X, Clock, ShieldAlert, Ban, Check, Trash2, MapPin, MessageSquare, Radio } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-line-bright p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-signal/10 border border-signal/20 text-signal">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-paper text-sm sm:text-base">
                Recent Signal Connections
              </h3>
              <p className="font-mono text-[10px] text-ash">
                VOLATILE CACHE · 24H AUTO-PURGE
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ash hover:text-paper hover:bg-surface-raised transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4 space-y-2">
              <Radio className="w-8 h-8 text-ash/40 animate-pulse" />
              <div className="font-display text-sm font-semibold text-paper">No Connection History</div>
              <p className="font-mono text-xs text-ash/70 max-w-xs">
                Ephemeral connection logs from the last 24h will appear here for audit and reporting.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isBlocked = blockedUserIds.includes(log.partnerUserId);

              return (
                <div
                  key={log.matchId}
                  className="p-3 rounded-xl bg-surface-raised border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-line flex items-center justify-center font-mono font-bold text-signal text-xs shrink-0">
                      {log.partnerDisplayName?.slice(0, 2).toUpperCase() || "??"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-semibold text-paper truncate">
                        {log.partnerDisplayName}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-ash">
                        <span className="flex items-center gap-1 text-signal">
                          <MapPin className="w-3 h-3" />
                          ~{(log as any).distanceMeters ?? 150}m
                        </span>
                        <span>·</span>
                        <span>{formatTimeAgo(log.matchedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenReportForPastMatch(
                          log.matchId,
                          log.partnerUserId,
                          log.partnerDisplayName
                        )
                      }
                      className="px-2.5 py-1 rounded bg-surface hover:bg-alert/15 border border-line hover:border-alert/30 text-ash hover:text-alert text-xs font-mono transition-colors flex items-center gap-1"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Report</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBlocked || blockingId === log.partnerUserId}
                      onClick={() => handleBlock(log.partnerUserId, log.partnerDisplayName)}
                      className={`px-2.5 py-1 rounded border text-xs font-mono transition-colors flex items-center gap-1 ${
                        isBlocked
                          ? "bg-alert/15 border-alert/30 text-alert"
                          : "bg-surface hover:bg-alert/15 border-line hover:border-alert/30 text-ash hover:text-alert"
                      }`}
                    >
                      {isBlocked ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-alert" />
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
        <div className="flex items-center justify-between pt-3 border-t border-line">
          {logs.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-ash hover:text-alert font-mono text-xs transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Purge History</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-line text-paper font-display text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
