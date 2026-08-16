"use client";

import { Shield, Radio, Flame } from "lucide-react";

interface TrustBadgesProps {
  variant?: "desktop" | "mobile";
}

const BADGES = [
  {
    id: "PSEUDO",
    code: "ID-01",
    title: "Pseudonymous",
    desc: "Random callsign · No public profiles",
    icon: Shield,
  },
  {
    id: "PROX",
    code: "RNG-02",
    title: "Distance-based",
    desc: "Live proximity matching in radius",
    icon: Radio,
  },
  {
    id: "VOLATILE",
    code: "MEM-03",
    title: "No chat history",
    desc: "Volatile RAM · Wiped on disconnect",
    icon: Flame,
  },
];

export function TrustBadges({ variant = "desktop" }: TrustBadgesProps) {
  if (variant === "mobile") {
    return (
      <div className="flex items-center justify-center w-full">
        <span className="font-mono text-[10px] font-semibold tracking-wider text-signal bg-signal/10 border border-signal/20 px-3 py-1 rounded-full text-center">
          LOCAL · NO LOGS · LIVE
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
      {BADGES.map((b) => {
        const Icon = b.icon;
        return (
          <div
            key={b.id}
            className="cert-badge relative rounded-xl p-3 bg-surface border border-line flex flex-col justify-between transition-all duration-200 hover:border-signal/40 group shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-signal/10 border border-signal/20 flex items-center justify-center text-signal group-hover:bg-signal group-hover:text-ink transition-colors">
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="font-mono text-[9px] tracking-wider text-ash/80 uppercase">
                {b.code}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-paper font-display tracking-tight mb-0.5">
                {b.title}
              </div>
              <div className="text-[11px] text-ash leading-snug">
                {b.desc}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
