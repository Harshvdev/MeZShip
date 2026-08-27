"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { RadarDial } from "@/components/matching/RadarDial";
import { TrustBadges } from "@/components/common/TrustBadges";
import { ChatWindow } from "@/components/chat/ChatWindow";
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
  Radio,
  AlertTriangle,
  RotateCcw,
  LogOut,
  MapPin,
  RefreshCw,
  Compass,
  Lock,
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
    permissionDenied,
    locationName,
    retry: retryGeo,
  } = useGeolocation();

  const [matchingRadius, setMatchingRadius] = useState<number>(5000); // 5km default
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
    onlineCount,
    isPartnerTyping,
    setOnlineCount,
    startMatching,
    sendMessage,
    sendTyping,
    toggleReaction,
    skip,
    leave,
    blockPartner,
    reportPartner,
    reportPastMatch,
  } = useChatSocket(profile?.user_id, profile?.display_name, token, lat, lng);

  // Poll live stats & heartbeat
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

  // Check ban state
  useEffect(() => {
    if (!token) return;

    async function checkUserStatus() {
      try {
        const banRes = await fetch(getApiUrl("/api/bans/check"), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (banRes.ok) {
          const data = (await banRes.json()) as { isBanned?: boolean; ban?: { reason?: string } };
          if (data.isBanned) {
            setIsBanned(true);
            setBanReason(data.ban?.reason || "Account suspended due to safety report threshold.");
          }
        }
      } catch (e) {
        console.error("Status check error:", e);
      }
    }

    checkUserStatus();
  }, [token]);

  const radiusKm = Math.round(matchingRadius / 1000);
  const hasCoordinates = lat !== null && lng !== null;

  const handleStartChat = useCallback(() => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!hasCoordinates) {
      retryGeo();
      return;
    }
    startMatching(matchingRadius);
  }, [user, router, hasCoordinates, retryGeo, startMatching, matchingRadius]);

  const handleRadiusChange = useCallback((km: number) => {
    setMatchingRadius(km * 1000);
  }, []);

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

  const isMatched = chatState === "MATCHED";
  const isSearching = chatState === "SEARCHING";

  return (
    <div className="h-full h-dvh max-h-dvh w-full flex flex-col overflow-hidden bg-ink text-paper font-body">
      {/* Header */}
      <Navbar
        profile={profile}
        onlineCount={onlineCount}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLocation={() => setShowLocationModal(true)}
        onOpenLogs={() => setShowMatchLogs(true)}
        onSignOut={signOut}
      />

      {/* Main Viewport */}
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-col overflow-hidden">
        {/* BAN SCREEN STATE */}
        {isBanned ? (
          <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-alert/30 text-center max-w-md mx-auto my-auto shadow-2xl animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-alert/10 border border-alert/30 text-alert flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold font-display text-paper mb-2">Signal Blocked</h2>
            <p className="text-xs sm:text-sm text-ash mb-4 leading-relaxed">
              {banReason || "Your account has accumulated reports exceeding safety limits."}
            </p>
            <p className="font-mono text-[11px] text-ash/70">
              Safety blocks are automated based on distinct community reports.
            </p>
          </div>
        ) : isMatched ? (
          /* ACTIVE MATCHED CHAT VIEW (Desktop & Mobile Full Height) */
          <div className="flex-1 min-h-0 w-full max-w-4xl mx-auto flex flex-col overflow-hidden animate-fade-in">
            <ChatWindow
              partner={partner}
              messages={messages}
              currentUserId={profile?.user_id}
              partnerLeaveReason={partnerLeaveReason}
              isPartnerTyping={isPartnerTyping}
              onTypingChange={sendTyping}
              onToggleReaction={toggleReaction}
              onSendMessage={sendMessage}
              onSkip={skip}
              onLeave={leave}
              onOpenReport={() => setShowReport(true)}
              onOpenBlock={() => setShowBlock(true)}
            />
          </div>
        ) : !mounted || (geoLoading && !hasCoordinates) ? (
          /* INITIAL GPS ACQUISITION / SSR MOUNTING STATE */
          <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center p-4 sm:p-6 text-center my-auto animate-fade-in">
            <div className="flex flex-col items-center gap-3 text-ash font-mono text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-signal" />
              <span>Acquiring satellite constellation & location fix...</span>
            </div>
          </div>
        ) : !hasCoordinates ? (
          /* LOCATION PERMISSION MANDATORY STATE */
          <div className="flex-1 min-h-0 w-full max-w-lg mx-auto flex flex-col items-center justify-center p-4 sm:p-6 text-center my-auto animate-fade-in">
            <div className="w-full p-6 sm:p-8 rounded-2xl bg-surface border border-line-bright shadow-2xl space-y-5">
              {/* Radar/Pin Icon Badge */}
              <div className="w-16 h-16 rounded-2xl bg-signal/10 border border-signal/30 text-signal flex items-center justify-center mx-auto shadow-inner relative">
                <Compass className="w-8 h-8 animate-pulse" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-signal animate-ping" />
              </div>

              {/* Headline & Explanation */}
              <div className="space-y-2">
                <span className="font-mono text-[10px] sm:text-xs font-semibold tracking-widest text-signal bg-signal/10 border border-signal/20 px-3 py-1 rounded-full uppercase">
                  Location Permission Required
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-display text-paper leading-tight pt-1">
                  Enable Location to Connect Nearby
                </h2>
                <p className="text-xs sm:text-sm text-ash leading-relaxed font-body max-w-md mx-auto">
                  MeZShip matches you with people nearby based on physical distance. Please allow location permissions in your browser to discover local peers.
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-2 space-y-3">
                <button
                  type="button"
                  onClick={retryGeo}
                  disabled={geoLoading}
                  className="btn-ptt w-full py-3.5 px-6 rounded-xl font-display font-bold text-sm sm:text-base tracking-wide flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all cursor-pointer"
                >
                  {geoLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Acquiring Location Signal...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      <span>{permissionDenied ? "Grant Location Permission" : "Acquire Location Fix"}</span>
                    </>
                  )}
                </button>

                {permissionDenied && (
                  <p className="font-mono text-[11px] text-alert/90 bg-alert/10 border border-alert/20 rounded-lg p-2.5 leading-relaxed text-left">
                    💡 <strong>Browser Blocked:</strong> Click the site permissions / lock icon in your browser address bar and set <strong>Location</strong> to <strong>Allow</strong>, then click Grant Location Permission.
                  </p>
                )}
              </div>

              {/* Privacy Guarantee Footer */}
              <div className="pt-3 border-t border-line flex items-center justify-center gap-2 text-ash font-mono text-[10px]">
                <Lock className="w-3 h-3 text-signal" />
                <span>Zero location logs · Coordinates never stored · Live proximity only</span>
              </div>
            </div>
          </div>
        ) : (
          /* UNIFIED MATCHING VIEW (When Coordinates Are Active) */
          <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
            {/* MOBILE LAYOUT (<lg) */}
            <div className="lg:hidden flex-1 min-h-0 w-full max-w-sm mx-auto flex flex-col justify-between items-center py-2 px-1 gap-2 overflow-hidden">
              {isSearching ? (
                /* Mobile Active Searching Screen */
                <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-between py-2 animate-fade-in">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-signal bg-signal/10 border border-signal/20 px-3 py-1 rounded-full shrink-0">
                    SIGNAL SEARCH ACTIVE
                  </span>

                  {/* Centered Hero Radar */}
                  <div className="flex-1 min-h-0 flex items-center justify-center my-auto">
                    <RadarDial
                      radiusKm={radiusKm}
                      onRadiusChange={handleRadiusChange}
                      state={chatState}
                      onStartMatching={handleStartChat}
                      partnerDistanceMeters={partner?.distanceMeters}
                      hasPreciseDistance={partner?.hasPreciseDistance}
                      partnerDisplayName={partner?.displayName}
                    />
                  </div>

                  {/* Cancel Button at bottom */}
                  <div className="w-full shrink-0 pt-2">
                    <button
                      type="button"
                      onClick={leave}
                      className="w-full py-3.5 px-4 rounded-xl border border-line-bright bg-surface-raised hover:bg-surface text-paper font-display font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                    >
                      <span className="w-2 h-2 rounded-full bg-signal animate-ping" />
                      <span>Searching ({radiusKm} km) · Cancel [Esc]</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Mobile Idle / Skipped Screen */
                <div className="flex-1 min-h-0 w-full flex flex-col justify-between items-center gap-2">
                  {/* Top Compact Headline */}
                  <div className="flex flex-col items-center text-center space-y-1 shrink-0 pt-2">
                    <h1 className="font-display text-lg sm:text-xl font-bold tracking-tight text-paper leading-tight">
                      There&apos;s always someone nearby.
                    </h1>
                    <p className="text-[11px] text-ash max-w-xs leading-tight font-body">
                      Spontaneous distance chat. Zero profiles, zero logs.
                    </p>
                  </div>

                  {/* Center Radar Dial */}
                  <div className="flex-1 min-h-0 flex items-center justify-center py-1">
                    <RadarDial
                      radiusKm={radiusKm}
                      onRadiusChange={handleRadiusChange}
                      state={chatState}
                      onStartMatching={handleStartChat}
                      partnerDistanceMeters={partner?.distanceMeters}
                      hasPreciseDistance={partner?.hasPreciseDistance}
                      partnerDisplayName={partner?.displayName}
                    />
                  </div>

                  {/* Bottom Trust Pills + Primary CTA */}
                  <div className="w-full flex flex-col gap-2 shrink-0 pb-1">
                    <TrustBadges variant="mobile" />

                    {chatState === "PARTNER_SKIPPED" ? (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          type="button"
                          onClick={leave}
                          className="px-3.5 py-3.5 rounded-xl border border-line bg-surface hover:bg-surface-raised text-ash hover:text-paper font-display text-xs transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleStartChat}
                          className="btn-ptt flex-1 py-3.5 px-4 rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span>Match Next Peer ({radiusKm} km)</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartChat}
                        className="btn-ptt w-full py-3.5 px-5 rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-xl select-none active:scale-[0.98]"
                      >
                        <Radio className="w-4 h-4" />
                        <span>Start Matching</span>
                        <span className="font-mono text-xs opacity-75 font-normal ml-1">
                          [{radiusKm} km]
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* DESKTOP VIEW (>= lg) */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-8 items-center flex-1 min-h-0 w-full overflow-hidden">
              {/* LEFT COLUMN (~40% on Desktop): Brand thesis, headline, trust tags, CTA */}
              <div className="lg:col-span-5 flex flex-col justify-center gap-5 px-1">
                {/* Eyebrow & Headline */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold tracking-wider text-signal bg-signal/10 border border-signal/20 px-2.5 py-0.5 rounded">
                      LOCAL · NO LOGS · LIVE
                    </span>
                  </div>
                  <h1 className="font-display text-2xl lg:text-4xl font-bold tracking-tight text-paper leading-tight">
                    There&apos;s always someone nearby.
                  </h1>
                  <p className="text-xs lg:text-sm text-ash leading-relaxed font-body">
                    Connect spontaneously with people within your radius. Random callsigns, zero public profiles, and zero chat logs.
                  </p>
                </div>

                {/* Trust Badges - Equipment Certification Tags */}
                <div className="w-full">
                  <TrustBadges variant="desktop" />
                </div>

                {/* Push-to-Talk CTA Button */}
                <div className="pt-1">
                  {isSearching ? (
                    <button
                      type="button"
                      onClick={leave}
                      className="w-full py-3.5 px-4 rounded-xl border border-line bg-surface hover:bg-surface-raised text-paper font-display font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span className="w-2 h-2 rounded-full bg-signal animate-ping" />
                      <span>Searching ({radiusKm} km) · Cancel [Esc]</span>
                    </button>
                  ) : chatState === "PARTNER_SKIPPED" ? (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        type="button"
                        onClick={leave}
                        className="px-3.5 py-3 rounded-xl border border-line bg-surface hover:bg-surface-raised text-ash hover:text-paper font-display text-xs transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleStartChat}
                        className="btn-ptt flex-1 py-3 px-4 rounded-xl font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-lg"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Match Next Peer ({radiusKm} km)</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartChat}
                      className="btn-ptt w-full py-3.5 px-5 rounded-xl font-display font-bold text-base tracking-wide flex items-center justify-center gap-2 shadow-xl select-none"
                    >
                      <Radio className="w-4 h-4" />
                      <span>Start Matching</span>
                      <span className="font-mono text-xs opacity-75 font-normal ml-1">
                        [{radiusKm} km]
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN (~60% on Desktop): Signature Radar Dial */}
              <div className="lg:col-span-7 flex flex-col items-center justify-center p-2">
                <div className="w-full max-w-[480px] p-6 rounded-2xl bg-surface/40 border border-line/60 flex flex-col items-center justify-center shadow-2xl relative">
                  <RadarDial
                    radiusKm={radiusKm}
                    onRadiusChange={handleRadiusChange}
                    state={chatState}
                    onStartMatching={handleStartChat}
                    partnerDistanceMeters={partner?.distanceMeters}
                    hasPreciseDistance={partner?.hasPreciseDistance}
                    partnerDisplayName={partner?.displayName}
                  />
                </div>
              </div>
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
        locationName={locationName}
        loading={geoLoading}
        permissionDenied={permissionDenied}
        radiusMeters={matchingRadius}
        onRadiusChange={setMatchingRadius}
        onRetry={retryGeo}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentDisplayName={profile?.display_name || ""}
        onUpdateDisplayName={updateDisplayName}
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
        token={token}
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
