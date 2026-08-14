"use client";

import type { ChatMessage } from "@/hooks/useChatSocket";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.senderId === "system") {
    return (
      <div className="flex justify-center my-3 animate-fade-in">
        <div className="px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium text-center shadow-sm">
          {message.text}
        </div>
      </div>
    );
  }

  const { isSelf, text, timestamp } = message;
  const timeString = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`flex flex-col mb-3 animate-slide-up ${
        isSelf ? "items-end" : "items-start"
      }`}
    >
      <div
        className={`max-w-[80%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-md ${
          isSelf
            ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-none"
            : "bg-white/10 text-gray-100 border border-white/10 rounded-bl-none"
        }`}
      >
        {text}
      </div>
      <span className="text-[10px] text-gray-500 mt-1 px-1">{timeString}</span>
    </div>
  );
}
