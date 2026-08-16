"use client";

import type { ChatMessage } from "@/hooks/useChatSocket";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  if (message.senderId === "system") {
    return (
      <div className="flex justify-center my-2.5 animate-fade-in">
        <div className="px-3 py-1 rounded-md bg-surface border border-line text-xs font-mono text-ash text-center max-w-sm">
          {message.text}
        </div>
      </div>
    );
  }

  const { isSelf, text, timestamp } = message;
  const timeString = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className={`flex flex-col mb-2.5 animate-slide-up ${
        isSelf ? "items-end" : "items-start"
      }`}
    >
      <div
        className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2 rounded-xl text-sm leading-relaxed break-words font-body select-text ${
          isSelf
            ? "bg-signal text-ink font-medium rounded-br-xs shadow-sm"
            : "bg-surface-raised text-paper border border-line rounded-bl-xs shadow-sm"
        }`}
      >
        {text}
      </div>
      <span className="font-mono text-[10px] text-ash/80 mt-1 px-1 tracking-tight">
        {timeString}
      </span>
    </div>
  );
}

