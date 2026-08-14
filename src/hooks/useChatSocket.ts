"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WebSocketServerMessage, ReportReason } from "@/lib/protocol";

export type ChatState =
  | "IDLE"
  | "SEARCHING"
  | "MATCHED"
  | "PARTNER_SKIPPED"
  | "ERROR";

export interface ChatMessage {
  id: string;
  senderId: string;
  isSelf: boolean;
  text: string;
  timestamp: number;
}

export interface PartnerInfo {
  userId: string;
  displayName: string;
  distanceMeters: number;
  campusId: string;
}

export function useChatSocket(
  userId: string | undefined,
  displayName: string | undefined,
  token: string | null,
  userLat: number | null,
  userLng: number | null
) {
  const [chatState, setChatState] = useState<ChatState>("IDLE");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const currentCampusesRef = useRef<string[]>([]);
  const currentRadiusRef = useRef<number>(2000);

  const getWsHost = () => {
    if (typeof window === "undefined") return "localhost:8787";
    const loc = window.location;
    return loc.hostname === "localhost" ? "localhost:8787" : loc.host;
  };

  const closeCurrentSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Connect to Active Match Room
  const connectToRoom = useCallback(
    (matchId: string) => {
      closeCurrentSocket();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${getWsHost()}/ws/room/${matchId}?userId=${encodeURIComponent(
        userId || ""
      )}&displayName=${encodeURIComponent(displayName || "")}&matchId=${matchId}&token=${encodeURIComponent(
        token || ""
      )}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setChatState("MATCHED");
        setStatusMessage("Connected! Say hello.");
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketServerMessage = JSON.parse(event.data);
          if (data.type === "message") {
            setMessages((prev) => [
              ...prev,
              {
                id: data.id,
                senderId: data.senderId,
                isSelf: data.senderId === userId,
                text: data.text,
                timestamp: data.timestamp,
              },
            ]);
          } else if (data.type === "partner_skipped") {
            setChatState("PARTNER_SKIPPED");
            setStatusMessage("Your partner skipped the chat.");
          } else if (data.type === "error") {
            setStatusMessage(data.message);
          }
        } catch (e) {
          console.error("Room WS Parse Error:", e);
        }
      };

      ws.onclose = () => {
        // Socket closed
      };

      ws.onerror = (err) => {
        console.error("Room WS error:", err);
      };
    },
    [userId, displayName, token, closeCurrentSocket]
  );

  // Connect to Queue
  const startMatching = useCallback(
    (campusIds: string[], radius = 2000) => {
      if (!userId) return;
      closeCurrentSocket();

      currentCampusesRef.current = campusIds;
      currentRadiusRef.current = radius;
      setMessages([]);
      setPartner(null);
      setCurrentMatchId(null);
      setChatState("SEARCHING");
      setStatusMessage("Searching for a compatible nearby match...");

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${getWsHost()}/ws/queue?userId=${encodeURIComponent(
        userId
      )}&displayName=${encodeURIComponent(
        displayName || ""
      )}&lat=${userLat || 0}&lng=${userLng || 0}&campuses=${encodeURIComponent(
        campusIds.join(",")
      )}&radius=${radius}&token=${encodeURIComponent(token || "")}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data: WebSocketServerMessage = JSON.parse(event.data);
          if (data.type === "match_found") {
            setCurrentMatchId(data.matchId);
            setPartner({
              userId: data.partner.userId,
              displayName: data.partner.displayName,
              distanceMeters: data.distanceMeters,
              campusId: data.campusId,
            });
            connectToRoom(data.matchId);
          } else if (data.type === "queue_joined") {
            setStatusMessage(data.message);
          }
        } catch (e) {
          console.error("Queue WS Parse error:", e);
        }
      };

      ws.onerror = () => {
        setStatusMessage("Connection failed. Check worker server.");
        setChatState("ERROR");
      };
    },
    [userId, displayName, token, userLat, userLng, closeCurrentSocket, connectToRoom]
  );

  // Send a message to active partner
  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !wsRef.current || chatState !== "MATCHED") return;

      // Optimistic local add
      const tempId = `temp_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          senderId: userId || "",
          isSelf: true,
          text: trimmed,
          timestamp: Date.now(),
        },
      ]);

      wsRef.current.send(
        JSON.stringify({
          type: "message",
          text: trimmed,
        })
      );
    },
    [userId, chatState]
  );

  // Skip current match and re-queue without reload
  const skip = useCallback(() => {
    if (wsRef.current && chatState === "MATCHED") {
      try {
        wsRef.current.send(JSON.stringify({ type: "skip" }));
      } catch (e) {
        console.error("Skip send error:", e);
      }
    }
    // Re-queue
    startMatching(currentCampusesRef.current, currentRadiusRef.current);
  }, [chatState, startMatching]);

  // Leave completely
  const leave = useCallback(() => {
    closeCurrentSocket();
    setChatState("IDLE");
    setMessages([]);
    setPartner(null);
    setCurrentMatchId(null);
    setStatusMessage("");
  }, [closeCurrentSocket]);

  // Block partner
  const blockPartner = useCallback(async () => {
    if (!partner || !token) return false;
    try {
      const res = await fetch("/api/blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: partner.userId }),
      });
      if (res.ok) {
        skip();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [partner, token, skip]);

  // Report partner
  const reportPartner = useCallback(
    async (reason: ReportReason, details?: string) => {
      if (!partner || !currentMatchId || !token) return false;
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reportedUserId: partner.userId,
            matchId: currentMatchId,
            reason,
            details,
          }),
        });

        if (res.ok) {
          skip();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [partner, currentMatchId, token, skip]
  );

  useEffect(() => {
    return () => {
      closeCurrentSocket();
    };
  }, [closeCurrentSocket]);

  return {
    chatState,
    messages,
    partner,
    currentMatchId,
    statusMessage,
    startMatching,
    sendMessage,
    skip,
    leave,
    blockPartner,
    reportPartner,
  };
}
