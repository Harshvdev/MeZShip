"use client";

import { useState, useEffect } from "react";
import { X, Dices, Check, UserX, Trash2 } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl glass-panel border border-white/15 p-6 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <h3 className="font-semibold text-white text-base">Account Settings</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-white/10">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "profile"
                ? "bg-teal-500 text-gray-950 font-bold"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Display Name
          </button>
          <button
            onClick={() => setActiveTab("blocks")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "blocks"
                ? "bg-teal-500 text-gray-950 font-bold"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Blocked Users
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-4">
          {activeTab === "profile" && (
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Pseudonymous Display Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={30}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-teal-400 focus:outline-none text-sm text-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={generateRandomName}
                    title="Generate Random Name"
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
                  >
                    <Dices className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  This is the public identity shown to other users during chats.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-teal-400 font-medium">
                  {nameSaved && "Display name updated!"}
                </span>
                <button
                  type="submit"
                  disabled={isSavingName || !displayName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-gray-950 font-bold text-xs transition-colors shadow-md shadow-teal-500/20 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSavingName ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === "blocks" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Blocked users will never be matched with you.
              </p>
              {blockedUsers.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 rounded-xl bg-white/5 border border-white/10">
                  No blocked users.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {blockedUsers.map((b) => (
                    <div
                      key={b.blocked_user_id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <UserX className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-200 font-medium">
                          {b.blocked?.display_name || "User"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnblock(b.blocked_user_id)}
                        className="flex items-center gap-1 text-rose-400 hover:text-rose-300 p-1 rounded-lg hover:bg-rose-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
