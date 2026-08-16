"use client";

import { useState, useEffect } from "react";
import { X, Dices, Check, UserX, Trash2, Sliders } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface BlockedUser {
  blocked_user_id: string;
  blocked: {
    user_id: string;
    display_name: string;
  };
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDisplayName: string;
  onUpdateDisplayName: (name: string) => Promise<boolean>;
  token: string | null;
}

export function SettingsModal({
  isOpen,
  onClose,
  currentDisplayName,
  onUpdateDisplayName,
  token,
}: SettingsModalProps) {
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [activeTab, setActiveTab] = useState<"profile" | "blocks">("profile");

  useEffect(() => {
    setDisplayName(currentDisplayName);
  }, [currentDisplayName]);

  useEffect(() => {
    if (isOpen && token && activeTab === "blocks") {
      fetchBlockedUsers();
    }
  }, [isOpen, token, activeTab]);

  const fetchBlockedUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(getApiUrl("/api/blocks"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { blocks?: BlockedUser[] };
        setBlockedUsers(data.blocks || []);
      }
    } catch (e) {
      console.error("Fetch blocks error:", e);
    }
  };

  const handleUnblock = async (blockedUserId: string) => {
    if (!token) return;
    try {
      const res = await fetch(getApiUrl(`/api/blocks/${blockedUserId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setBlockedUsers((prev) =>
          prev.filter((b) => b.blocked_user_id !== blockedUserId)
        );
      }
    } catch (e) {
      console.error("Unblock error:", e);
    }
  };

  const generateRandomName = () => {
    const animals = ["Fox", "Owl", "Panda", "Wolf", "Hawk", "Otter", "Lynx", "Falcon", "Bear"];
    const colors = ["Blue", "Silver", "Crimson", "Golden", "Jade", "Cosmic", "Shadow", "Neon"];
    const num = Math.floor(100 + Math.random() * 900);
    const random = `${colors[Math.floor(Math.random() * colors.length)]}${
      animals[Math.floor(Math.random() * animals.length)]
    }${num}`;
    setDisplayName(random);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingName(true);
    setNameSaved(false);
    const success = await onUpdateDisplayName(displayName);
    setIsSavingName(false);
    if (success) {
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-line-bright p-5 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-signal" />
            <h3 className="font-display font-bold text-paper text-sm sm:text-base">
              Signal & Callsign Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ash hover:text-paper hover:bg-surface-raised transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-3 pb-2 border-b border-line">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-3 py-1 rounded-md font-mono text-xs font-medium transition-colors ${
              activeTab === "profile"
                ? "bg-signal text-ink font-bold"
                : "text-ash hover:text-paper bg-surface-raised"
            }`}
          >
            CALLSIGN IDENT
          </button>
          <button
            onClick={() => setActiveTab("blocks")}
            className={`px-3 py-1 rounded-md font-mono text-xs font-medium transition-colors ${
              activeTab === "blocks"
                ? "bg-signal text-ink font-bold"
                : "text-ash hover:text-paper bg-surface-raised"
            }`}
          >
            SIGNAL BLOCKS ({blockedUsers.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-3">
          {activeTab === "profile" && (
            <form onSubmit={handleSaveName} className="space-y-3.5">
              <div>
                <label className="block font-mono text-[11px] text-ash mb-1 uppercase tracking-wider">
                  Signal Handle (Pseudonym)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={30}
                    className="flex-1 font-mono px-3 py-2 rounded-lg bg-surface-raised border border-line focus:border-signal focus:outline-none text-xs sm:text-sm text-paper transition-colors"
                  />
                  <button
                    type="button"
                    onClick={generateRandomName}
                    title="Generate Random Callsign"
                    className="p-2 rounded-lg bg-surface-raised hover:bg-surface border border-line text-signal transition-colors"
                  >
                    <Dices className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-mono text-[10px] text-ash/70 mt-1">
                  Public volatile callsign broadcast to matched proximity peers.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-xs text-signal">
                  {nameSaved && "Callsign synchronized."}
                </span>
                <button
                  type="submit"
                  disabled={isSavingName || !displayName.trim()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-signal hover:bg-signal/90 text-ink font-display font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingName ? "Saving..." : "Apply Callsign"}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === "blocks" && (
            <div className="space-y-2.5">
              <p className="font-mono text-[11px] text-ash">
                Excluded signal peers will never be paired in matchmaking.
              </p>
              {blockedUsers.length === 0 ? (
                <div className="p-4 text-center font-mono text-xs text-ash rounded-lg bg-surface-raised border border-line">
                  No blocked peers.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5">
                  {blockedUsers.map((b) => (
                    <div
                      key={b.blocked_user_id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-surface-raised border border-line text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <UserX className="w-3.5 h-3.5 text-ash" />
                        <span className="text-paper">
                          {b.blocked?.display_name || "Blocked Peer"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnblock(b.blocked_user_id)}
                        className="flex items-center gap-1 text-alert hover:text-alert/80 p-1 rounded hover:bg-alert/10 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Unblock</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

