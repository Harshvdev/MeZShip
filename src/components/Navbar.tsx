"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Settings, LogOut, Clock, ChevronDown, User } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";

interface NavbarProps {
  profile: UserProfile | null;
  onOpenSettings: () => void;
  onOpenLogs?: () => void;
  onSignOut: () => void;
  onlineCount?: number;
}

export function Navbar({
  profile,
  onOpenSettings,
  onOpenLogs,
  onSignOut,
  onlineCount = 0,
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
    <header className="w-full border-b border-white/10 glass-panel sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
            <Image
              src="/logo.png"
              alt="MeZShip Logo"
              fill
              sizes="(max-width: 640px) 32px, 36px"
              priority
              className="object-contain"
            />
          </div>
          <span className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
            MeZShip
          </span>
        </Link>

        {/* Right Section: Online Count & User Dropdown */}
        <div className="flex items-center gap-2.5">
          {/* Live Online Badge */}
          <div
            title="Active campus users online right now"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>
              {onlineCount}{" "}
              <span className="hidden xs:inline">online</span>
            </span>
          </div>

          {profile ? (
            /* Unified User Menu */
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs sm:text-sm group"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="font-medium text-gray-200 max-w-[110px] sm:max-w-[160px] truncate">
                  {profile.display_name}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                    showMenu ? "rotate-180 text-white" : ""
                  }`}
                />
              </button>

              {/* Floating Dropdown */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl glass-panel border border-white/15 shadow-2xl p-1.5 z-50 animate-fade-in">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                      Signed in as
                    </div>
                    <div className="text-xs font-semibold text-white truncate mt-0.5">
                      {profile.display_name}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onOpenSettings();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-indigo-400" />
                    <span>Settings & Campuses</span>
                  </button>

                  {onOpenLogs && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpenLogs();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Clock className="w-4 h-4 text-teal-400" />
                      <span>Recent Connections</span>
                    </button>
                  )}

                  <div className="my-1 border-t border-white/10" />

                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-rose-300 hover:bg-rose-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth"
              className="px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/30"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
