"use client";

import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { RadarQueue } from "@/components/matching/RadarQueue";
import { CampusSelector, type CampusOption } from "@/components/matching/CampusSelector";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ReportModal } from "@/components/modals/ReportModal";
import { BlockConfirmModal } from "@/components/modals/BlockConfirmModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { LocationModal } from "@/components/modals/LocationModal";
import { useAuth } from "@/hooks/useAuth";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useChatSocket } from "@/hooks/useChatSocket";
import type { ReportReason } from "@/lib/protocol";
import {
  Sparkles,
  MapPin,
  Shield,
  Users,
  Compass,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Sliders,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const { user, profile, token, updateDisplayName, signOut } = useAuth();
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
  const [matchingRadius, setMatchingRadius] = useState<number>(2000);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const {
    chatState,
    messages,
    partner,
    statusMessage,
    startMatching,
    sendMessage,
    skip,
    leave,
    blockPartner,
    reportPartner,
  } = useChatSocket(profile?.user_id, profile?.display_name, token, lat, lng);

  // 1. Fetch available campuses based on user location
  useEffect(() => {
    async function loadCampuses() {
      setCampusesLoading(true);
      try {
        const queryParams = lat && lng ? `?lat=${lat}&lng=${lng}` : "";
        const res = await fetch(`/api/campuses${queryParams}`);
        if (res.ok) {
          const data = (await res.json()) as { campuses?: CampusOption[] };
          if (data.campuses) {
            setCampuses(data.campuses);
            if (data.campuses.length > 0) {
              setSelectedCampusIds((prev) => {
                if (prev.length === 0) {
                  // Pre-select inside campus or first 2 closest
                  const inside = data.campuses!.filter((c) => c.isInside).map((c) => c.id);
                  return inside.length > 0 ? inside : data.campuses!.slice(0, 2).map((c) => c.id);
                }
                return prev;
              });
            }
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

  // 2. Fetch User Campus Preferences & Check Ban State
  useEffect(() => {
    if (!token) return;

    async function checkUserStatus() {
      try {
        // Preferences
        const prefRes = await fetch("/api/preferences", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (prefRes.ok) {
          const data = (await prefRes.json()) as { preferences?: string[] };
          if (data.preferences && data.preferences.length > 0) {
            setSelectedCampusIds(data.preferences);
          }
        }

        // Ban Check
        const banRes = await fetch("/api/bans/check", {
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
      await fetch("/api/preferences", {
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

  const handleStartChat = () => {
    if (selectedCampusIds.length === 0) {
      alert("Please select at least one campus.");
      return;
    }
    startMatching(selectedCampusIds, matchingRadius);
  };

  const insideCampus = useMemo(() => campuses.find((c) => c.isInside), [campuses]);
  const nearestCampus = useMemo(() => (campuses.length > 0 ? campuses[0] : null), [campuses]);

  return (
    <div className="flex-1 flex flex-col">
      <Navbar
        profile={profile}
        onOpenSettings={() => setShowSettings(true)}
        onSignOut={signOut}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-center">
        {/* BAN SCREEN STATE */}
        {isBanned ? (
          <div className="p-8 rounded-3xl glass-panel border border-rose-500/30 text-center max-w-lg mx-auto animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Account Suspended
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              {banReason || "Your account has accumulated reports exceeding safety limits."}
            </p>
            <p className="text-xs text-gray-500">
              Bans are automated based on distinct community reports.
            </p>
          </div>
        ) : !user ? (
          /* PUBLIC LANDING VIEW */
          <div className="flex flex-col items-center text-center py-12 px-4 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Campus Proximity Random Chat</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white max-w-2xl leading-tight">
              Spontaneous conversations with people on your campus.
            </h1>

            <p className="text-base text-gray-400 max-w-lg mt-4 mb-8">
              MeZShip pairs you for 1-to-1 chats strictly within eligible campus geofences. Pseudonymous names, zero chat retention, and automatic community safeguards.
            </p>

            <Link
              href="/auth"
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <span>Get Started & Chat</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 max-w-3xl w-full text-left">
              <div className="p-5 rounded-2xl glass-panel border border-white/10">
                <Compass className="w-6 h-6 text-indigo-400 mb-3" />
                <h3 className="text-sm font-semibold text-white mb-1">Campus Geofenced</h3>
                <p className="text-xs text-gray-400">
                  Matching is restricted to users currently verified within configured campus boundaries.
                </p>
              </div>

              <div className="p-5 rounded-2xl glass-panel border border-white/10">
                <Users className="w-6 h-6 text-purple-400 mb-3" />
                <h3 className="text-sm font-semibold text-white mb-1">Pseudonymous Identity</h3>
                <p className="text-xs text-gray-400">
                  No public profiles or follower graphs. Enjoy randomized display names you can edit anytime.
                </p>
              </div>

              <div className="p-5 rounded-2xl glass-panel border border-white/10">
                <Shield className="w-6 h-6 text-emerald-400 mb-3" />
                <h3 className="text-sm font-semibold text-white mb-1">Zero Chat Retention</h3>
                <p className="text-xs text-gray-400">
                  Messages exist purely in memory during active matches and are never written to any database.
                </p>
              </div>
            </div>
          </div>
        ) : chatState === "MATCHED" ? (
          /* ACTIVE 1-TO-1 CHAT */
          <div className="w-full flex justify-center animate-fade-in">
            <ChatWindow
              partner={partner}
              messages={messages}
              onSendMessage={sendMessage}
              onSkip={skip}
              onLeave={leave}
              onOpenReport={() => setShowReport(true)}
              onOpenBlock={() => setShowBlock(true)}
            />
          </div>
        ) : chatState === "SEARCHING" ? (
          /* RADAR SEARCHING STATE */
          <RadarQueue
            onCancel={leave}
            statusMessage={statusMessage}
            selectedCampusesCount={selectedCampusIds.length}
          />
        ) : chatState === "PARTNER_SKIPPED" ? (
          /* PARTNER SKIPPED STATE */
          <div className="p-8 rounded-3xl glass-panel border border-white/10 text-center max-w-md mx-auto animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Partner Left</h3>
            <p className="text-xs text-gray-400 mb-6">
              Your chat partner skipped or disconnected from the session.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={leave}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-medium transition-colors"
              >
                Exit to Home
              </button>
              <button
                onClick={handleStartChat}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-colors"
              >
                Find Next Partner
              </button>
            </div>
          </div>
        ) : (
          /* IDLE HOME LOBBY */
          <div className="w-full max-w-2xl mx-auto space-y-6 animate-fade-in">
            {/* Greeting & Location Notice */}
            <div className="p-6 rounded-3xl glass-panel border border-white/10 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-indigo-400 font-medium uppercase tracking-wider mb-1">
                    Ready to Connect
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    Welcome, {profile?.display_name || "Campus Explorer"}!
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Select the campuses where you want to find people nearby.
                  </p>
                </div>

                {/* Interactive Location Badge */}
                <button
                  type="button"
                  onClick={() => setShowLocationModal(true)}
                  className="flex items-center gap-2.5 self-start sm:self-auto px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/40 text-xs text-gray-200 transition-all group text-left shadow-sm"
                >
                  <MapPin
                    className={`w-4 h-4 shrink-0 ${
                      isCalibrated
                        ? "text-amber-400"
                        : insideCampus
                        ? "text-emerald-400"
                        : "text-indigo-400"
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-white truncate max-w-[200px] leading-tight">
                      {insideCampus
                        ? insideCampus.name.split("(")[0].trim()
                        : nearestCampus?.distanceMeters !== undefined
                        ? `Near ${nearestCampus.name.split("(")[0].trim()}`
                        : lat && lng
                        ? "Coordinates Acquired"
                        : "Detecting Location..."}
                    </div>
                    <div className="text-[10px] text-indigo-300 font-medium group-hover:underline flex items-center gap-1 mt-0.5">
                      <span>{isCalibrated ? "Calibrated (Change)" : "Calibrate / Refine"}</span>
                      <Sliders className="w-2.5 h-2.5" />
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Campus Selector */}
            <div className="p-6 rounded-3xl glass-panel border border-white/10">
              <CampusSelector
                campuses={campuses}
                selectedIds={selectedCampusIds}
                onChange={handleUpdateCampuses}
                loading={campusesLoading}
                onCalibrateLocation={(calLat, calLng, label) =>
                  setCalibratedLocation(calLat, calLng, label)
                }
              />

              {/* Matching Radius Option */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-gray-300 font-medium">Matching Distance:</span>
                  <span className="text-indigo-400 font-semibold">
                    Up to {matchingRadius >= 1000 ? `${matchingRadius / 1000} km` : `${matchingRadius} m`}
                  </span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={5000}
                  step={250}
                  value={matchingRadius}
                  onChange={(e) => setMatchingRadius(Number(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
                />
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartChat}
                className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.01]"
              >
                <Compass className="w-4 h-4" />
                <span>Start Finding People</span>
              </button>
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
        onClose={() => setShowReport(false)}
        onSubmitReport={async (reason: ReportReason, details?: string) => {
          return reportPartner(reason, details);
        }}
        targetDisplayName={partner?.displayName}
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
