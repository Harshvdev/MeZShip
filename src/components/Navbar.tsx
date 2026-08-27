"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Settings, LogOut, Clock, MapPin, SlidersHorizontal } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";
import { Logo } from "@/components/common/Logo";

interface NavbarProps {
  profile: UserProfile | null;
  onOpenSettings: () => void;
  onOpenLocation?: () => void;
  onOpenLogs?: () => void;
  onSignOut: () => void;
  onlineCount?: number;
  loading?: boolean;
}

export function Navbar({
  profile,
  onOpenSettings,
  onOpenLocation,
  onOpenLogs,
  onSignOut,
  onlineCount = 0,
  loading = false,
}: NavbarProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  return (
    <header className="w-full border-b border-line bg-surface-raised/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-13 sm:h-14 flex items-center justify-between">
        {/* Brand & Live Mono Count */}
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            {/* Radar Signal Logo */}
            <div className="w-8 h-8 rounded-lg bg-surface border border-signal/30 flex items-center justify-center text-signal group-hover:border-signal group-hover:shadow-[0_0_12px_rgba(47,228,141,0.25)] transition-all shadow-sm">
              <Logo size={22} className="group-hover:scale-105 transition-transform" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base sm:text-lg font-bold tracking-tight text-paper group-hover:text-signal transition-colors leading-tight">
                MeZShip
              </span>
              {/* Mobile sub-mono line */}
              <span className="sm:hidden font-mono text-[10px] text-ash flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-signal inline-block animate-pulse" />
                {onlineCount} online
              </span>
            </div>
          </Link>

          {/* Desktop Live Online Readout */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-surface border border-line text-xs text-ash font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse shrink-0" />
            <span className="text-paper font-semibold">{onlineCount}</span>
            <span>online</span>
          </div>
        </div>

        {/* Right Section: Quiet Pseudonym Pill or Auth */}
        <div className="flex items-center gap-2">
          {profile ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                aria-expanded={showMenu}
                aria-haspopup="true"
                className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-line hover:border-line-bright transition-colors text-xs text-ash hover:text-paper group"
              >
                {/* Quiet pseudonym label, not an avatar circle */}
                <span className="font-mono text-[11px] sm:text-xs text-ash group-hover:text-paper max-w-[100px] sm:max-w-[140px] truncate">
                  {profile.display_name}
                </span>
                <SlidersHorizontal className="w-3.5 h-3.5 text-ash group-hover:text-signal transition-colors shrink-0" />
              </button>

              {/* Instrument Settings Dropdown */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-surface-raised border border-line-bright shadow-2xl p-1.5 z-50 animate-fade-in">
                  <div className="px-2.5 py-1.5 border-b border-line mb-1">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-ash">
                      SIGNAL CALLSIGN
                    </div>
                    <div className="font-mono text-xs font-semibold text-signal truncate mt-0.5">
                      {profile.display_name}
                    </div>
                  </div>

                  {onOpenLocation && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenLocation();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-ash hover:text-paper hover:bg-surface transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-signal" />
                      <span>Location & Radius</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-ash hover:text-paper hover:bg-surface transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-signal" />
                    <span>Callsign & Settings</span>
                  </button>

                  {onOpenLogs && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenLogs();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-ash hover:text-paper hover:bg-surface transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-signal" />
                      <span>Recent Connections</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-line" />

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-alert hover:bg-alert/10 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-alert" />
                    <span>Disconnect Identity</span>
                  </button>
                </div>
              )}
            </div>
          ) : loading ? (
            <div className="h-7 w-20 sm:w-24 rounded-lg bg-surface border border-line animate-pulse" />
          ) : (
            <Link
              href="/auth"
              className="px-3.5 py-1.5 text-xs font-display font-semibold rounded-lg bg-signal text-ink hover:bg-signal/90 transition-colors shadow-sm"
            >
              Connect
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

