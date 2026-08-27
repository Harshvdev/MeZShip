"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, MapPin, Radio, ShieldAlert, UserX, LogOut, MoreVertical, SkipForward, Reply, X } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ConfirmButton } from "./ConfirmButton";
import type { ChatMessage, PartnerInfo } from "@/hooks/useChatSocket";
import type { MessageReplyInfo } from "@/lib/protocol";
import { formatDistance } from "@/lib/distance";

interface ChatWindowProps {
  partner: PartnerInfo | null;
  messages: ChatMessage[];
  currentUserId?: string;
  currentUserDisplayName?: string;
  partnerLeaveReason?: "skip" | "leave" | "disconnect" | null;
  isPartnerTyping?: boolean;
  onTypingChange?: (isTyping: boolean) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onSendMessage: (text: string, replyTo?: MessageReplyInfo) => void;
  onSkip: () => void;
  onLeave: () => void;
  onOpenReport: () => void;
  onOpenBlock: () => void;
}

export function ChatWindow({
  partner,
  messages,
  currentUserId,
  currentUserDisplayName,
  partnerLeaveReason,
  isPartnerTyping = false,
  onTypingChange,
  onToggleReaction,
  onSendMessage,
  onSkip,
  onLeave,
  onOpenReport,
  onOpenBlock,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const [matchSeconds, setMatchSeconds] = useState(0);
  const [showSafetyMenu, setShowSafetyMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live match elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setMatchSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Clear active reply when partner leaves or skips
  useEffect(() => {
    if (partnerLeaveReason) {
      setReplyingTo(null);
    }
  }, [partnerLeaveReason]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPartnerTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleReply = useCallback((message: ChatMessage) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  }, []);

  const handleScrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-signal", "bg-signal/10");
      setTimeout(() => {
        el.classList.remove("ring-2", "ring-signal", "bg-signal/10");
      }, 1200);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    if (onTypingChange && !partnerLeaveReason) {
      onTypingChange(text.length > 0);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || partnerLeaveReason) return;
    if (onTypingChange) onTypingChange(false);

    const replyPayload: MessageReplyInfo | undefined = replyingTo
      ? {
          id: replyingTo.id,
          senderId: replyingTo.senderId,
          senderName: replyingTo.isSelf
            ? (currentUserDisplayName || "You")
            : (partner?.displayName || "Partner"),
          text: replyingTo.text,
        }
      : undefined;

    onSendMessage(inputText, replyPayload);
    setInputText("");
    setReplyingTo(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && replyingTo) {
      e.preventDefault();
      e.stopPropagation();
      setReplyingTo(null);
    }
  };

  const isPartnerLeft = Boolean(partnerLeaveReason);

  const mins = Math.floor(matchSeconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (matchSeconds % 60).toString().padStart(2, "0");

  return (
    <div className="flex flex-col h-full w-full rounded-xl sm:rounded-2xl bg-surface border border-line overflow-hidden shadow-2xl animate-fade-in">
      {/* Top Status Header */}
      <div className="shrink-0 px-3 sm:px-4 py-2.5 bg-surface-raised border-b border-line flex items-center justify-between gap-2">
        {/* Left: Compact Status Pill (e.g. BlueFox482 · ~150m · 04:12) */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-2 h-2 rounded-full bg-signal animate-pulse shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono text-xs sm:text-sm font-semibold text-paper truncate">
              {partner?.displayName || "Connected Peer"}
            </span>
            <span className="text-ash font-mono text-xs">·</span>
            <span className="font-mono text-xs text-signal shrink-0 flex items-center gap-1">
              <MapPin className="w-3 h-3 inline" />
              {formatDistance(partner?.distanceMeters, partner?.hasPreciseDistance)}
            </span>
            <span className="text-ash font-mono text-xs">·</span>
            <span className="font-mono text-xs text-ash shrink-0">
              {mins}:{secs}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mobile Leave Button (hidden on desktop sm:) */}
          <div className="sm:hidden">
            <ConfirmButton
              label="Leave"
              confirmLabel="Confirm"
              icon={<LogOut className="w-3.5 h-3.5 shrink-0" />}
              confirmIcon={<LogOut className="w-3.5 h-3.5 shrink-0 animate-pulse" />}
              onAction={onLeave}
              variant="leave"
              size="compact"
              title="Exit matchmaking and return to radar"
              confirmTitle="Click again to confirm exit"
            />
          </div>

          {/* Safety Options Menu */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowSafetyMenu(!showSafetyMenu)}
              aria-label="Safety and report options"
              className="p-1.5 rounded-lg bg-surface hover:bg-surface-raised border border-line text-ash hover:text-paper transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showSafetyMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowSafetyMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-surface-raised border border-line-bright shadow-2xl p-1.5 z-40 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSafetyMenu(false);
                      onOpenReport();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-alert hover:bg-alert/10 transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-alert" />
                    <span>Report Peer...</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowSafetyMenu(false);
                      onOpenBlock();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-alert hover:bg-alert/10 transition-colors"
                  >
                    <UserX className="w-3.5 h-3.5 text-alert" />
                    <span>Block Peer</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Partner Left / Disconnected Notification Banner */}
      {isPartnerLeft && (
        <div className="px-3.5 py-2 bg-alert/10 border-b border-alert/20 flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-mono text-alert">
            <span className="w-1.5 h-1.5 rounded-full bg-alert inline-block" />
            <span>
              {partnerLeaveReason === "leave"
                ? "Signal lost: Partner left session"
                : partnerLeaveReason === "disconnect"
                ? "Signal lost: Partner disconnected"
                : "Partner skipped connection"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onLeave}
              className="px-2.5 py-1 rounded bg-surface hover:bg-surface-raised border border-line text-ash hover:text-paper font-display text-xs transition-colors"
            >
              Exit
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="px-2.5 py-1 rounded bg-signal text-ink font-display font-semibold text-xs hover:bg-signal/90 transition-colors"
            >
              Find Next
            </button>
          </div>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 min-h-0 w-full p-3 sm:p-4 pt-4 sm:pt-6 overflow-y-auto overflow-x-hidden space-y-2">
        {messages.length === 0 ? (
          <div className="flex-1 min-h-[160px] py-8 flex flex-col items-center justify-center text-center p-4 text-ash font-mono text-xs my-auto">
            <div className="w-10 h-10 rounded-full bg-signal/10 border border-signal/20 flex items-center justify-center text-signal mb-2">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <p className="font-semibold text-paper">Direct 1-to-1 Ephemeral Channel</p>
            <p className="text-[11px] text-ash/80 mt-0.5 max-w-sm">
              Volatile RAM transmission. Messages are wiped immediately when session ends.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              partnerDisplayName={partner?.displayName}
              onToggleReaction={onToggleReaction}
              onReply={handleReply}
              onScrollToMessage={handleScrollToMessage}
            />
          ))
        )}

        {/* Live Partner Typing Indicator Bubble */}
        {isPartnerTyping && (
          <div className="flex flex-col mb-2.5 items-start animate-slide-up w-full min-w-0">
            <div className="bg-surface-raised border border-line rounded-xl rounded-bl-xs px-3.5 py-2.5 shadow-sm flex items-center gap-1.5 max-w-[85%]">
              <span className="w-1.5 h-1.5 rounded-full bg-signal animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-signal animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-signal animate-bounce" />
            </div>
            <span className="font-mono text-[10px] text-ash/80 mt-1 px-1 tracking-tight truncate max-w-full">
              {partner?.displayName || "Partner"} is typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Active Replying To Banner */}
      {replyingTo && (
        <div className="px-3 sm:px-4 py-2 bg-surface-raised/95 border-t border-line flex items-center justify-between gap-2.5 animate-slide-up backdrop-blur-xs min-w-0 w-full overflow-hidden">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
            <div className="w-1 self-stretch rounded-full bg-signal shrink-0" />
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-signal truncate">
                <Reply className="w-3 h-3 shrink-0" />
                <span className="truncate">
                  Replying to{" "}
                  {replyingTo.isSelf
                    ? "yourself"
                    : partner?.displayName || "Partner"}
                </span>
              </div>
              <p className="text-ash/90 text-xs font-body truncate">
                {replyingTo.text}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-lg text-ash hover:text-paper hover:bg-surface border border-transparent hover:border-line transition-colors shrink-0"
            aria-label="Cancel reply"
            title="Cancel reply [Esc]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Subtle Typing Status Bar above Composer */}
      {isPartnerTyping && !replyingTo && (
        <div className="px-3.5 py-1 bg-surface-raised/90 border-t border-line text-[11px] font-mono text-signal flex items-center gap-1.5 animate-fade-in min-w-0 w-full overflow-hidden">
          <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse shrink-0" />
          <span className="truncate">{partner?.displayName || "Partner"} is typing...</span>
        </div>
      )}

      {/* Bottom Control Bar: Leave (desktop only) + Skip on bottom left, Composer in center, Send on right */}
      <div className="px-2.5 sm:px-3 py-2 bg-surface-raised border-t border-line flex items-center gap-1.5 sm:gap-2 min-w-0 w-full overflow-hidden">
        {/* Bottom Left Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Desktop-only Leave / Exit button (hidden on mobile, shown on sm:) */}
          <div className="hidden sm:block">
            <ConfirmButton
              label="Leave"
              confirmLabel="Confirm"
              icon={<LogOut className="w-3.5 h-3.5 shrink-0" />}
              confirmIcon={<LogOut className="w-3.5 h-3.5 shrink-0 animate-pulse" />}
              onAction={onLeave}
              variant="leave"
              size="normal"
              title="Exit matchmaking and return to radar"
              confirmTitle="Click again to confirm exit"
            />
          </div>

          {/* Skip / Next button (visible on both mobile and desktop) */}
          <ConfirmButton
            label="Skip"
            confirmLabel="Confirm"
            icon={<SkipForward className="w-3.5 h-3.5 shrink-0" />}
            confirmIcon={<SkipForward className="w-3.5 h-3.5 shrink-0 animate-pulse" />}
            onAction={onSkip}
            variant="skip"
            size="normal"
            title="Skip to next nearby peer [Esc]"
            confirmTitle="Click again to confirm skip"
          />
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSend} className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
          <input
            id="chat-message-input"
            name="chatMessage"
            autoComplete="off"
            ref={inputRef}
            type="text"
            value={inputText}
            disabled={isPartnerLeft}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onInput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              if (onTypingChange && !partnerLeaveReason) {
                onTypingChange(val.length > 0);
              }
            }}
            onBlur={() => onTypingChange?.(false)}
            placeholder={
              isPartnerLeft
                ? "Partner left. Click 'Skip' or 'Leave'..."
                : replyingTo
                ? `Replying to ${replyingTo.isSelf ? "yourself" : (partner?.displayName || "Partner")}...`
                : "Type ephemeral message (Enter to send)..."
            }
            maxLength={500}
            className="w-full min-w-0 px-3 sm:px-3.5 py-2 rounded-lg bg-surface border border-line focus:border-signal focus:outline-none text-xs sm:text-sm text-paper placeholder-ash/50 transition-colors disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isPartnerLeft}
            className="p-2 sm:p-2.5 rounded-lg bg-signal text-ink hover:bg-signal/90 disabled:opacity-30 disabled:hover:bg-signal transition-all shrink-0 font-medium shadow-sm"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
