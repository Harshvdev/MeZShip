"use client";

import { useState, useRef, useEffect } from "react";
import { SmilePlus } from "lucide-react";
import type { ChatMessage } from "@/hooks/useChatSocket";
import { ALLOWED_REACTION_EMOJIS } from "@/lib/protocol";

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserId?: string;
  onToggleReaction?: (messageId: string, emoji: string) => void;
}

export function MessageBubble({
  message,
  currentUserId,
  onToggleReaction,
}: MessageBubbleProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const pickerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  if (message.senderId === "system") {
    return (
      <div className="flex justify-center my-2.5 animate-fade-in">
        <div className="px-3 py-1 rounded-md bg-surface border border-line text-xs font-mono text-ash text-center max-w-sm">
          {message.text}
        </div>
      </div>
    );
  }

  const { isSelf, text, timestamp, status, reactions } = message;
  const timeString = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Calculate dynamic placement (flip below bubble if close to top edge of scroll parent)
  useEffect(() => {
    if (showPicker && bubbleRef.current) {
      const bubbleRect = bubbleRef.current.getBoundingClientRect();
      const parent = bubbleRef.current.closest(".overflow-y-auto") || bubbleRef.current.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        // If distance between top of bubble and top of scroll parent is less than 60px, place below!
        if (bubbleRect.top - parentRect.top < 60) {
          setPlacement("bottom");
          return;
        }
      }
      if (bubbleRect.top < 180) {
        setPlacement("bottom");
      } else {
        setPlacement("top");
      }
    }
  }, [showPicker]);

  // Close reaction picker on click outside
  useEffect(() => {
    if (!showPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPicker]);

  const handleSelectEmoji = (emoji: string) => {
    if (onToggleReaction) {
      onToggleReaction(message.id, emoji);
    }
    setShowPicker(false);
  };

  const reactionEntries = reactions ? Object.entries(reactions).filter(([_, users]) => users.length > 0) : [];

  return (
    <div
      ref={bubbleRef}
      className={`group relative flex flex-col mb-2.5 animate-slide-up ${
        isSelf ? "items-end" : "items-start"
      }`}
    >
      <div className={`relative flex items-center gap-1.5 ${isSelf ? "flex-row-reverse" : "flex-row"}`}>
        {/* Message Bubble Body */}
        <div
          className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2 rounded-xl text-sm leading-relaxed break-words font-body select-text ${
            isSelf
              ? "bg-signal text-ink font-medium rounded-br-xs shadow-sm"
              : "bg-surface-raised text-paper border border-line rounded-bl-xs shadow-sm"
          }`}
        >
          {text}
        </div>

        {/* Reaction Trigger Button (Reveals on hover / active) */}
        {onToggleReaction && (
          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            aria-label="React to message"
            className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-full bg-surface hover:bg-surface-raised border border-line text-ash hover:text-paper transition-all duration-150 shrink-0 shadow-xs ${
              showPicker ? "!opacity-100 bg-surface-raised text-signal" : ""
            }`}
          >
            <SmilePlus className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Floating Emoji Picker Popover (Dynamic Top vs Bottom) */}
        {showPicker && (
          <div
            ref={pickerRef}
            className={`absolute z-40 ${
              placement === "top" ? "-top-12 origin-bottom" : "top-full mt-2 origin-top"
            } ${
              isSelf ? "right-0" : "left-0"
            } max-w-[calc(100vw-3rem)] flex items-center gap-0.5 sm:gap-1 px-2 py-1.5 rounded-full bg-surface-raised/95 backdrop-blur-md border border-line-bright shadow-2xl animate-fade-in`}
          >
            {ALLOWED_REACTION_EMOJIS.map((emoji) => {
              const hasReacted = currentUserId && reactions?.[emoji]?.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelectEmoji(emoji)}
                  className={`text-base sm:text-lg hover:scale-125 active:scale-95 transition-transform p-1 rounded-full leading-none flex items-center justify-center ${
                    hasReacted ? "bg-signal/20 ring-1 ring-signal" : "hover:bg-surface"
                  }`}
                  title={emoji}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Interactive Reaction Badges */}
      {reactionEntries.length > 0 && (
        <div className={`flex flex-wrap items-center gap-1 mt-1 px-0.5 ${isSelf ? "justify-end" : "justify-start"}`}>
          {reactionEntries.map(([emoji, users]) => {
            const hasReacted = Boolean(currentUserId && users.includes(currentUserId));
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction?.(message.id, emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono transition-all select-none ${
                  hasReacted
                    ? "bg-signal/15 border border-signal/40 text-paper shadow-xs hover:bg-signal/25"
                    : "bg-surface-raised border border-line text-ash hover:text-paper hover:bg-surface"
                }`}
                title={`${users.length} reaction${users.length > 1 ? "s" : ""}`}
              >
                <span>{emoji}</span>
                <span className="text-[10px] font-semibold">{users.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Timestamp & Delivery State Badge */}
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-ash/80 mt-1 px-1 tracking-tight">
        <span>{timeString}</span>
        {isSelf && (
          <>
            <span className="opacity-40">·</span>
            {status === "sending" ? (
              <span className="text-signal/90 animate-pulse font-semibold">Sending...</span>
            ) : status === "failed" ? (
              <span className="text-alert font-semibold">Failed</span>
            ) : (
              <span className="text-ash/70">Sent</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

