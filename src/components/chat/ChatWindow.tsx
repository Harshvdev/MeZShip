"use client";

import { useState, useRef, useEffect } from "react";
import { Send, MapPin, Sparkles } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ActionBar } from "./ActionBar";
import type { ChatMessage, PartnerInfo } from "@/hooks/useChatSocket";

interface ChatWindowProps {
  partner: PartnerInfo | null;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSkip: () => void;
  onLeave: () => void;
  onOpenReport: () => void;
  onOpenBlock: () => void;
}

export function ChatWindow({
  partner,
  messages,
  onSendMessage,
  onSkip,
  onLeave,
  onOpenReport,
  onOpenBlock,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText("");
  };

  return (
    <div className="flex flex-col h-[560px] max-h-[80vh] w-full rounded-2xl glass-panel border border-white/10 overflow-hidden shadow-2xl">
      {/* Partner Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md">
            {partner?.displayName?.slice(0, 2).toUpperCase() || "??"}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              {partner?.displayName || "Connected Partner"}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-indigo-400">
              <MapPin className="w-3 h-3" />
              <span>~{partner?.distanceMeters ?? 150}m away on campus</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live 1-to-1</span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500 text-xs">
            <Sparkles className="w-8 h-8 text-indigo-400/50 mb-2" />
            <p className="font-medium text-gray-400">You are matched!</p>
            <p>Messages are temporary and never stored on disk.</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Form */}
      <form
        onSubmit={handleSend}
        className="px-4 py-3 bg-white/5 border-t border-white/10 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message (max 500 characters)..."
          maxLength={500}
          className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 focus:border-indigo-500 focus:outline-none text-sm text-white placeholder-gray-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Action Bar (Skip, Leave, Secondary Actions) */}
      <ActionBar
        onSkip={onSkip}
        onLeave={onLeave}
        onOpenReport={onOpenReport}
        onOpenBlock={onOpenBlock}
      />
    </div>
  );
}
