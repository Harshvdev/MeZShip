"use client";

import Link from "next/link";
import { Sparkles, Settings, LogOut, ShieldAlert } from "lucide-react";
import type { UserProfile } from "@/hooks/useAuth";

interface NavbarProps {
  profile: UserProfile | null;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export function Navbar({ profile, onOpenSettings, onSignOut }: NavbarProps) {
  return (
    <header className="w-full border-b border-white/10 glass-panel sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              MeZShip
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Campus Random Chat
            </span>
          </div>
        </Link>

        {/* User Identity & Controls */}
        <div className="flex items-center gap-3">
          {profile ? (
            <>
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium text-gray-200">{profile.display_name}</span>
                <Settings className="w-4 h-4 text-gray-400 ml-1" />
              </button>

              <button
                onClick={onSignOut}
                title="Sign Out"
                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-600/30"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
