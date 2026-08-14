"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { CampusSelector, type CampusOption } from "@/components/matching/CampusSelector";
import { ReportModal } from "@/components/modals/ReportModal";
import { BlockConfirmModal } from "@/components/modals/BlockConfirmModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { LocationModal } from "@/components/modals/LocationModal";
import { MatchLogsModal } from "@/components/modals/MatchLogsModal";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useChatSocket } from "@/hooks/useChatSocket";
import type { ReportReason } from "@/lib/protocol";
import { getApiUrl } from "@/lib/api";
import {
  Send,
  MapPin,
  Sparkles,
  Radio,
  X,
  AlertTriangle,
  RotateCcw,
  Sliders,
  ShieldAlert,
  UserX,
  LogOut,
  MoreVertical,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const { user, profile, token, loading: authLoading, updateDisplayName, signOut } = useAuth();
  const {
    lat,
    lng,
    accuracy,
    loading: geoLoading,
    isCalibrated,
    locationName,
    retry: retryGeo,
    setCalibratedLocation,
    resetToAuto,
  } = useGeolocation();

  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [selectedCampusIds, setSelectedCampusIds] = useState<string[]>([]);
  const [campusesLoading, setCampusesLoading] = useState<boolean>(true);
  const [matchingRadius, setMatchingRadius] = useState<number>(5000);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);

  // Chat input
  const [inputText, setInputText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showPartnerMenu, setShowPartnerMenu] = useState(false);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showMatchLogs, setShowMatchLogs] = useState(false);
  const [pastReportTarget, setPastReportTarget] = useState<{
    matchId: string;
    reportedUserId: string;
    displayName: string;
  } | null>(null);

  const {
    chatState,
    messages,
    partner,
    statusMessage,
    partnerLeaveReason,
    queueCount,
    onlineCount,
    setOnlineCount,
    startMatching,
    sendMessage,
    skip,
    leave,
    blockPartner,
    reportPartner,
    reportPastMatch,
  } = useChatSocket(profile?.user_id, profile?.display_name, token, lat, lng);

  // Auto-scroll chat messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when match starts
  useEffect(() => {
    if (chatState === "MATCHED") {
      setShowPartnerMenu(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [chatState]);

  // Poll live stats & send presence heartbeat
  useEffect(() => {
    if (authLoading) return;

    let isMounted = true;

    async function fetchStats() {
      try {
        const res = await fetch(getApiUrl("/api/stats"));
        if (res.ok && isMounted) {
          const data = (await res.json()) as { onlineCount?: number; queueCount?: number };
          if (typeof data.onlineCount === "number" && setOnlineCount) {
            const countExcludingUser = token ? Math.max(0, data.onlineCount - 1) : data.onlineCount;
            setOnlineCount(countExcludingUser);
          }
        }
      } catch {}
    }

    async function sendHeartbeat() {
      if (!token) return;
      try {
        await fetch(getApiUrl("/api/presence"), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }

    sendHeartbeat();
    fetchStats();
    const interval = setInterval(() => {
      sendHeartbeat();
      fetchStats();
    }, 12000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token, authLoading, setOnlineCount]);

  // Fetch available campuses based on user location
  useEffect(() => {
    async function loadCampuses() {
      setCampusesLoading(true);
      try {
        const queryParams = lat && lng ? `?lat=${lat}&lng=${lng}` : "";
        const res = await fetch(getApiUrl(`/api/campuses${queryParams}`));
        if (res.ok) {
          const data = (await res.json()) as { campuses?: CampusOption[] };
          if (data.campuses) {
            setCampuses(data.campuses);
          }
        } else {
          setCampuses([]);
        }
      } catch (err) {
        console.error("Failed to load campuses:", err);
        setCampuses([]);
      } finally {
        setCampusesLoading(false);
      }
    }
    loadCampuses();
  }, [lat, lng]);

  // Fetch User Preferences & Check Ban State
  useEffect(() => {
    if (!token) return;

    async function checkUserStatus() {
      try {
        // Preferences
        const prefRes = await fetch(getApiUrl("/api/preferences"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (prefRes.ok) {
          const data = (await prefRes.json()) as { preferences?: string[] };
          if (data.preferences && data.preferences.length > 0) {
            setSelectedCampusIds(data.preferences);
          }
        }

        // Ban Check
        const banRes = await fetch(getApiUrl("/api/bans/check"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (banRes.ok) {
          const data = (await banRes.json()) as { isBanned?: boolean; ban?: { reason?: string } };
          if (data.isBanned) {
            setIsBanned(true);
            setBanReason(data.ban?.reason || "Account suspended due to report threshold.");
          }
        }
      } catch (e) {
        console.error("Status check error:", e);
      }
    }

    checkUserStatus();
  }, [token]);

  const handleUpdateCampuses = async (ids: string[]) => {
    setSelectedCampusIds(ids);
    if (!token) return;
    try {
      await fetch(getApiUrl("/api/preferences"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ campusIds: ids }),
      });
    } catch (e) {
      console.error("Failed to save preferences:", e);
    }
  };

  const handleStartChat = useCallback(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    // Default 5 km radius proximity match
    startMatching(selectedCampusIds, matchingRadius);
  }, [user, router, startMatching, selectedCampusIds, matchingRadius]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || partnerLeaveReason || chatState !== "MATCHED") return;
    sendMessage(inputText);
    setInputText("");
  };

  // Keyboard Shortcuts (Esc to Start / Skip / Cancel, Enter to Start when idle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      const isInputFocused = activeTag === "input" || activeTag === "textarea";

      if (e.key === "Escape") {
        e.preventDefault();
        if (chatState === "MATCHED") {
          skip();
        } else if (chatState === "SEARCHING") {
          leave();
        } else if (chatState === "IDLE" || chatState === "PARTNER_SKIPPED") {
          handleStartChat();
        }
      } else if (e.key === "Enter" && !isInputFocused) {
        if (chatState === "IDLE" || chatState === "PARTNER_SKIPPED") {
          e.preventDefault();
          handleStartChat();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chatState, skip, leave, handleStartChat]);

  const insideCampus = useMemo(() => campuses.find((c) => c.isInside), [campuses]);
  const nearestCampus = useMemo(() => (campuses.length > 0 ? campuses[0] : null), [campuses]);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar
        profile={profile}
        onlineCount={onlineCount}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLogs={() => setShowMatchLogs(true)}
        onSignOut={signOut}
      />

      <main className="flex-1 max-w-3xl w-full mx-auto px-2 py-3 sm:p-6 flex flex-col justify-center">
        {/* BAN SCREEN STATE */}
        {isBanned ? (
          <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-rose-500/30 text-center max-w-md mx-auto animate-fade-in shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Account Suspended</h2>
            <p className="text-sm text-gray-400 mb-4">
              {banReason || "Your account has accumulated reports exceeding safety limits."}
            </p>
            <p className="text-xs text-gray-500">
              Bans are automated based on distinct community reports.
            </p>
          </div>
        ) : (
          /* OPENTALK STYLE CHAT CONTAINER */
          <div className="w-full rounded-2xl sm:rounded-3xl glass-panel border border-white/10 overflow-hidden shadow-2xl flex flex-col h-[520px] sm:h-[580px] max-h-[calc(100dvh-5.5rem)] relative transition-all duration-300">
            {/* Top Scope & Info Header */}
            <div className="px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-b border-white/10 bg-white/[0.03] flex items-center justify-between gap-2">
              {chatState === "MATCHED" && partner ? (
                /* Partner Header when Matched */
                <>
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-md shrink-0">
                      {partner.displayName?.slice(0, 2).toUpperCase() || "??"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold text-white leading-tight truncate">
                        {partner.displayName || "Connected Partner"}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] sm:text-xs text-teal-400 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                        <span className="truncate">~{partner.distanceMeters ?? 150}m away</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {partnerLeaveReason ? (
                      <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] sm:text-xs font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Left</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] sm:text-xs font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live 1:1</span>
                      </div>
                    )}

                    {/* Safety Options Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setShowPartnerMenu(!showPartnerMenu)}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition-colors"
                        title="Partner options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {showPartnerMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setShowPartnerMenu(false)}
                          />
                          <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl glass-panel border border-white/15 shadow-2xl p-1.5 z-30 animate-fade-in">
                            <button
                              onClick={() => {
                                setShowPartnerMenu(false);
                                setShowReport(true);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-amber-300 hover:bg-amber-500/10 transition-colors"
                            >
                              <ShieldAlert className="w-4 h-4 text-amber-400" />
                              <span>Report User...</span>
                            </button>

                            <button
                              onClick={() => {
                                setShowPartnerMenu(false);
                                setShowBlock(true);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-rose-300 hover:bg-rose-500/10 transition-colors"
                            >
                              <UserX className="w-4 h-4 text-rose-400" />
                              <span>Block User</span>
                            </button>

                            <div className="my-1 border-t border-white/10" />

                            <button
                              onClick={() => {
                                setShowPartnerMenu(false);
                                leave();
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Leave Chat</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* Default Header Pill */
                <div className="flex items-center justify-between w-full gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 hover:border-teal-400/40 text-teal-300 text-xs font-medium transition-all group max-w-[78%] min-w-0"
                    title="Click to refine location calibration"
                  >
                    <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                    <span className="truncate">
                      {insideCampus
                        ? `${insideCampus.name.split("(")[0].trim()} · < 5 km`
                        : locationName
                        ? `${locationName} · < 5 km`
                        : "Nearby · Under 5 km"}
                    </span>
                    <Sliders className="w-3 h-3 text-teal-400/60 group-hover:text-teal-300 shrink-0 ml-1" />
                  </button>

                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Auto-Match</span>
                  </div>
                </div>
              )}
            </div>

            {/* Middle Main Viewport */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col">
              {chatState === "IDLE" ? (
                /* IDLE STATE: Clean OpenTalk Card */
                <div className="flex-1 flex flex-col justify-between animate-fade-in">
                  <div className="space-y-6 pt-2">
                    {/* Welcoming Message Bubble */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 max-w-lg shadow-lg">
                      <h2 className="text-base sm:text-lg font-bold text-white mb-1.5">
                        Welcome back to MeZShip 🎉
                      </h2>
                      <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                        <span className="font-semibold text-emerald-400">{onlineCount}</span>{" "}
                        {onlineCount === 1 ? "person" : "people"} online right now. Connect with someone nearby anonymously in real-time.
                      </p>
                    </div>

                    {/* Start Chatting Button */}
                    <div>
                      <button
                        onClick={handleStartChat}
                        className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-teal-500 via-indigo-600 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white font-semibold text-sm shadow-xl shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.99] group"
                      >
                        <span className="text-amber-300 text-base group-hover:translate-x-0.5 transition-transform">
                          ▶
                        </span>
                        <span>Start chatting</span>
                      </button>
                    </div>
                  </div>

                  {/* Highlights Footer */}
                  <div className="pt-4 sm:pt-6 border-t border-white/5 flex flex-wrap items-center gap-3 sm:gap-6 text-[11px] sm:text-xs text-gray-400">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>Automatic 5 km radius</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                      <span>Pseudonymous identity</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span>Zero chat retention</span>
                    </div>
                  </div>
                </div>
              ) : chatState === "SEARCHING" ? (
                /* SEARCHING STATE: Radar Scanning Indicator */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6 animate-fade-in">
                  <div className="relative flex items-center justify-center w-36 h-36 sm:w-48 sm:h-48 my-3 sm:my-4">
                    <div className="absolute inset-0 rounded-full border border-teal-500/20 animate-radar-pulse" />
                    <div
                      className="absolute inset-0 rounded-full border border-indigo-500/30 animate-radar-pulse"
                      style={{ animationDelay: "1s" }}
                    />
                    <div
                      className="absolute inset-0 rounded-full border border-purple-500/30 animate-radar-pulse"
                      style={{ animationDelay: "2s" }}
                    />

                    {/* Center Node */}
                    <div className="relative z-10 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-teal-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-teal-500/30 border border-white/20">
                      <Radio className="w-5 h-5 sm:w-7 sm:h-7 text-white animate-pulse" />
                    </div>
                  </div>

                  <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
                    Searching for someone nearby
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-400 max-w-sm mb-3 sm:mb-4">
                    {statusMessage || "Scanning for online students within 5 km radius..."}
                  </p>

                  <div className="flex items-center gap-2 mb-4 sm:mb-6">
                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] sm:text-xs text-emerald-300 font-medium">
                      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{onlineCount} online</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-[11px] sm:text-xs text-teal-300 font-medium">
                      <MapPin className="w-3 h-3" />
                      <span>Under 5 km</span>
                    </div>
                  </div>

                  <button
                    onClick={leave}
                    className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel Search</span>
                  </button>
                </div>
              ) : chatState === "PARTNER_SKIPPED" ? (
                /* PARTNER SKIPPED / LEFT STATE */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6 animate-fade-in max-w-md mx-auto">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-3 sm:mb-4">
                    <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
                    {partnerLeaveReason === "leave"
                      ? "Partner Left the Chat"
                      : partnerLeaveReason === "disconnect"
                      ? "Partner Disconnected"
                      : "Partner Skipped"}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-400 mb-5 sm:mb-6">
                    {partnerLeaveReason === "leave"
                      ? "Your chat partner left the conversation."
                      : partnerLeaveReason === "disconnect"
                      ? "Partner disconnected. Reconnecting nearby..."
                      : "Partner skipped. Searching for next person within 5 km..."}
                  </p>
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <button
                      onClick={leave}
                      className="px-3.5 sm:px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
                    >
                      Exit to Home
                    </button>
                    <button
                      onClick={handleStartChat}
                      className="px-4 sm:px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-gray-950 text-xs font-bold shadow-lg shadow-teal-500/25 transition-all"
                    >
                      Find Next Partner
                    </button>
                  </div>
                </div>
              ) : chatState === "ERROR" ? (
                /* ERROR STATE */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 sm:p-6 animate-fade-in max-w-md mx-auto">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-3 sm:mb-4">
                    <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <h3 className="text-sm sm:text-base font-semibold text-white mb-1">
                    Connection Issue
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-400 mb-5 sm:mb-6">
                    {statusMessage || "Unable to establish matchmaking connection. Please try again."}
                  </p>
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <button
                      onClick={leave}
                      className="px-3.5 sm:px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStartChat}
                      className="px-4 sm:px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-gray-950 text-xs font-bold shadow-lg shadow-teal-500/25 transition-all"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                /* MATCHED ACTIVE MESSAGES STREAM */
                <div className="flex-1 flex flex-col justify-between">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-6 text-gray-500 text-xs my-auto">
                      <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-teal-400/50 mb-2 animate-pulse" />
                      <p className="font-medium text-gray-300">You are connected!</p>
                      <p className="text-gray-500 mt-0.5 text-[11px] sm:text-xs">
                        Messages are live in memory and never written to disk.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((msg) => (
                        <MessageBubble key={msg.id} message={msg} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Control Bar (OpenTalk Signature Bar) */}
            <div className="px-2.5 sm:px-4 py-2 sm:py-3 bg-white/[0.04] border-t border-white/10 flex items-center gap-1.5 sm:gap-2.5">
              {/* Dynamic Left Action Button */}
              {chatState === "IDLE" ? (
                <button
                  type="button"
                  onClick={handleStartChat}
                  className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-gray-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                >
                  <span>Start</span>
                  <span className="hidden md:inline-block text-[10px] font-semibold bg-black/20 text-black px-1.5 py-0.5 rounded">
                    Esc
                  </span>
                </button>
              ) : chatState === "SEARCHING" ? (
                <button
                  type="button"
                  onClick={leave}
                  className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold text-xs sm:text-sm transition-all shrink-0"
                >
                  <span>Stop</span>
                  <span className="hidden md:inline-block text-[10px] font-semibold bg-rose-500/30 text-rose-200 px-1.5 py-0.5 rounded">
                    Esc
                  </span>
                </button>
              ) : chatState === "MATCHED" ? (
                <button
                  type="button"
                  onClick={skip}
                  className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                >
                  <span>Skip</span>
                  <span className="hidden md:inline-block text-[10px] font-semibold bg-black/30 text-indigo-100 px-1.5 py-0.5 rounded">
                    Esc
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartChat}
                  className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-gray-950 font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                >
                  <span>Next</span>
                  <span className="hidden md:inline-block text-[10px] font-semibold bg-black/20 text-black px-1.5 py-0.5 rounded">
                    Esc
                  </span>
                </button>
              )}

              {/* Center Input Form */}
              <form onSubmit={handleSend} className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  disabled={chatState !== "MATCHED" || Boolean(partnerLeaveReason)}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    chatState === "IDLE"
                      ? "Start chatting nearby..."
                      : chatState === "SEARCHING"
                      ? "Searching for nearby users..."
                      : partnerLeaveReason
                      ? "Partner left. Press Next to match."
                      : "Type a message (max 500 chars)..."
                  }
                  maxLength={500}
                  className="w-full min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-teal-400 focus:outline-none text-xs sm:text-sm text-white placeholder-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={
                    chatState !== "MATCHED" || !inputText.trim() || Boolean(partnerLeaveReason)
                  }
                  className="p-2 sm:p-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-30 disabled:hover:bg-teal-500 text-gray-950 transition-all shrink-0 shadow-md"
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        lat={lat}
        lng={lng}
        accuracy={accuracy}
        isCalibrated={isCalibrated}
        locationName={locationName}
        loading={geoLoading}
        onRetry={retryGeo}
        onSetLocation={(newLat, newLng, label) => setCalibratedLocation(newLat, newLng, label)}
        onResetAuto={resetToAuto}
        campuses={campuses}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentDisplayName={profile?.display_name || ""}
        onUpdateDisplayName={updateDisplayName}
        campuses={campuses}
        selectedCampusIds={selectedCampusIds}
        onUpdateCampuses={handleUpdateCampuses}
        token={token}
      />

      <ReportModal
        isOpen={showReport}
        onClose={() => {
          setShowReport(false);
          setPastReportTarget(null);
        }}
        onSubmitReport={async (reason: ReportReason, details?: string) => {
          if (pastReportTarget) {
            return reportPastMatch(
              pastReportTarget.matchId,
              pastReportTarget.reportedUserId,
              reason,
              details
            );
          }
          return reportPartner(reason, details);
        }}
        targetDisplayName={pastReportTarget?.displayName || partner?.displayName}
      />

      <MatchLogsModal
        isOpen={showMatchLogs}
        onClose={() => setShowMatchLogs(false)}
        onOpenReportForPastMatch={(matchId, reportedUserId, displayName) => {
          setPastReportTarget({ matchId, reportedUserId, displayName });
          setShowReport(true);
        }}
        onBlockUser={async (targetUserId) => {
          return blockPartner(targetUserId);
        }}
      />

      <BlockConfirmModal
        isOpen={showBlock}
        onClose={() => setShowBlock(false)}
        onConfirmBlock={blockPartner}
        targetDisplayName={partner?.displayName}
      />
    </div>
  );
}

