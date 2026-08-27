"use client";

import { useState, useRef, useEffect, memo } from "react";
import { SmilePlus, Reply } from "lucide-react";
import type { ChatMessage } from "@/hooks/useChatSocket";
import { ALLOWED_REACTION_EMOJIS } from "@/lib/protocol";

interface MessageBubbleProps {
  message: ChatMessage;
  currentUserId?: string;
  partnerDisplayName?: string;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onReply?: (message: ChatMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  currentUserId,
  partnerDisplayName,
  onToggleReaction,
  onReply,
  onScrollToMessage,
}: MessageBubbleProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isPastThreshold, setIsPastThreshold] = useState(false);

  const pickerRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwipingHorizontal = useRef<boolean>(false);
  const hasVibrated = useRef<boolean>(false);

  if (message.senderId === "system") {
    return (
      <div className="flex justify-center my-2.5 animate-fade-in w-full min-w-0 px-2">
        <div className="px-3 py-1 rounded-md bg-surface border border-line text-xs font-mono text-ash text-center max-w-sm [overflow-wrap:anywhere] break-words">
          {message.text}
        </div>
      </div>
    );
  }

  const { isSelf, text, timestamp, status, reactions, replyTo } = message;
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

  // Touch Swipe-to-reply handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onReply) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingHorizontal.current = false;
    hasVibrated.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!onReply) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX.current;
    const diffY = currentY - touchStartY.current;

    // Detect if user intended horizontal swipe vs vertical scroll
    if (!isSwipingHorizontal.current) {
      if (Math.abs(diffX) > 8 && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
        isSwipingHorizontal.current = true;
      } else if (Math.abs(diffY) > 8) {
        return;
      }
    }

    if (isSwipingHorizontal.current) {
      // Swiping to the right
      if (diffX > 0) {
        // Damped offset with rubber-band curve
        const clamped = Math.min(diffX * 0.45, 60);
        setSwipeOffset(clamped);
        const reached = clamped >= 36;
        setIsPastThreshold(reached);

        if (reached && !hasVibrated.current) {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            try {
              navigator.vibrate(15);
            } catch {}
          }
          hasVibrated.current = true;
        } else if (!reached) {
          hasVibrated.current = false;
        }
      } else {
        setSwipeOffset(0);
        setIsPastThreshold(false);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isSwipingHorizontal.current && onReply && isPastThreshold) {
      onReply(message);
    }
    setSwipeOffset(0);
    setIsPastThreshold(false);
    isSwipingHorizontal.current = false;
    hasVibrated.current = false;
  };

  const handleTouchCancel = () => {
    setSwipeOffset(0);
    setIsPastThreshold(false);
    isSwipingHorizontal.current = false;
    hasVibrated.current = false;
  };

  const handleSelectEmoji = (emoji: string) => {
    if (onToggleReaction) {
      onToggleReaction(message.id, emoji);
    }
    setShowPicker(false);
  };

  const reactionEntries = reactions ? Object.entries(reactions).filter(([_, users]) => users.length > 0) : [];

  return (
    <div
      id={`msg-${message.id}`}
      ref={bubbleRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className={`group relative flex flex-col mb-2.5 animate-slide-up transition-colors duration-500 rounded-xl w-full min-w-0 max-w-full ${
        isSelf ? "items-end" : "items-start"
      }`}
    >
      {/* Touch Swipe-to-Reply Animated Indicator */}
      {swipeOffset > 0 && (
        <div
          className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10"
          style={{
            opacity: swipeOffset > 6 ? Math.min((swipeOffset - 6) / 24, 1) : 0,
            transform: `translateX(${Math.max(0, swipeOffset - 36)}px) scale(${
              isPastThreshold ? 1.15 : Math.max(0.7, swipeOffset / 36)
            })`,
            transition: swipeOffset === 0 ? "transform 0.2s ease-out, opacity 0.2s ease-out" : "none",
          }}
        >
          <div
            className={`p-1.5 rounded-full border shadow-md transition-all ${
              isPastThreshold
                ? "bg-signal text-ink border-signal shadow-signal/30 ring-2 ring-signal/40"
                : "bg-surface-raised text-signal border-line-bright"
            }`}
          >
            <Reply className="w-3.5 h-3.5" />
          </div>
        </div>
      )}

      {/* Bubble Row with Buttons and Message Body */}
      <div
        className={`relative flex items-center gap-1.5 max-w-full min-w-0 ${isSelf ? "flex-row-reverse" : "flex-row"}`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: swipeOffset === 0 ? "transform 0.2s cubic-bezier(0.2, 0, 0, 1)" : "none",
        }}
      >
        {/* Message Bubble Body */}
        <div
          className={`max-w-[85%] sm:max-w-[75%] min-w-0 px-3.5 py-2 rounded-xl text-sm leading-relaxed [overflow-wrap:anywhere] [word-break:break-word] break-words font-body select-text ${
            isSelf
              ? "bg-signal text-ink font-medium rounded-br-xs shadow-sm"
              : "bg-surface-raised text-paper border border-line rounded-bl-xs shadow-sm"
          }`}
        >
          {/* Quoted Replied Message Block */}
          {replyTo && (
            <button
              type="button"
              onClick={() => onScrollToMessage?.(replyTo.id)}
              className={`w-full min-w-0 text-left mb-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors flex flex-col gap-0.5 cursor-pointer select-none group/quote overflow-hidden ${
                isSelf
                  ? "bg-black/15 hover:bg-black/25 text-ink border-l-2 border-ink/70"
                  : "bg-surface/90 hover:bg-surface text-paper border-l-2 border-signal"
              }`}
              title="Jump to quoted message"
            >
              <div className="flex items-center gap-1 font-mono font-semibold text-[10px] opacity-90 min-w-0">
                <Reply className="w-2.5 h-2.5 inline shrink-0" />
                <span className="truncate min-w-0">
                  {replyTo.senderId === currentUserId
                    ? "You"
                    : partnerDisplayName || replyTo.senderName || "Partner"}
                </span>
              </div>
              <p className="line-clamp-1 truncate text-[11px] opacity-80 font-normal font-sans min-w-0 [overflow-wrap:anywhere]">
                {replyTo.text}
              </p>
            </button>
          )}

          {/* Main Message Text */}
          <div className="whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word] break-words min-w-0">
            {text}
          </div>
        </div>

        {/* Hover / Action Buttons Container (Reply + Reaction) */}
        <div
          className={`flex items-center gap-1 shrink-0 ${
            isSelf ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {/* Reply Button (Reveals on hover / focus) */}
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(message)}
              aria-label="Reply to message"
              title="Reply to message"
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-full bg-surface hover:bg-surface-raised border border-line text-ash hover:text-signal hover:border-signal/40 transition-all duration-150 shrink-0 shadow-xs active:scale-95"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Reaction Trigger Button (Reveals on hover / focus) */}
          {onToggleReaction && (
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              aria-label="React to message"
              title="React to message"
              className={`opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-full bg-surface hover:bg-surface-raised border border-line text-ash hover:text-paper transition-all duration-150 shrink-0 shadow-xs active:scale-95 ${
                showPicker ? "!opacity-100 bg-surface-raised text-signal border-signal/40" : ""
              }`}
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

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
});

