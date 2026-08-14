"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WebSocketServerMessage, ReportReason } from "@/lib/protocol";
import { saveMatchLog, updateMatchLogEnd, markMatchReported } from "@/lib/matchLogs";

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
  const [partnerLeaveReason, setPartnerLeaveReason] = useState<"skip" | "leave" | "disconnect" | null>(null);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [onlineCount, setOnlineCount] = useState<number>(1);

  const wsRef = useRef<WebSocket | null>(null);
  const currentCampusesRef = useRef<string[]>([]);
  const currentRadiusRef = useRef<number>(2000);
  const activeMatchIdRef = useRef<string | null>(null);
  const autoReconnectTimerRef = useRef<any>(null);

  const getWsBaseUrl = (path: string) => {
    if (process.env.NEXT_PUBLIC_WS_URL) {
      const base = process.env.NEXT_PUBLIC_WS_URL.replace(/\/+$/, "");
      return `${base}${path}`;
    }
    if (process.env.NEXT_PUBLIC_WORKER_URL) {
      const wsBase = process.env.NEXT_PUBLIC_WORKER_URL.replace(/^http/, "ws").replace(/\/+$/, "");
      return `${wsBase}${path}`;
    }
    if (typeof window !== "undefined") {
      const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocal) {
        return `ws://localhost:8787${path}`;
      }
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}${path}`;
    }
    return `ws://localhost:8787${path}`;
  };

  const closeCurrentSocket = useCallback(() => {
    if (autoReconnectTimerRef.current) {
      clearTimeout(autoReconnectTimerRef.current);
      autoReconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  }, []);

  // Connect to Active Match Room
  const connectToRoom = useCallback(
    (matchId: string) => {
      closeCurrentSocket();
      setPartnerLeaveReason(null);
      activeMatchIdRef.current = matchId;

      const wsUrl = `${getWsBaseUrl(`/ws/room/${matchId}`)}?userId=${encodeURIComponent(
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
            const reason = data.reason || "skip";
            const noticeText =
              reason === "leave"
                ? "👋 Partner left. Connecting to next person..."
                : reason === "disconnect"
                ? "⚠️ Partner disconnected. Connecting to next person..."
                : "⚡ Partner skipped. Connecting to next person...";

            if (activeMatchIdRef.current) {
              updateMatchLogEnd(activeMatchIdRef.current, reason);
            }

            setPartnerLeaveReason(reason);
            setStatusMessage(noticeText);
            setMessages((prev) => [
              ...prev,
              {
                id: `sys_${Date.now()}`,
                senderId: "system",
                isSelf: false,
                text: noticeText,
                timestamp: Date.now(),
              },
            ]);

            // Auto-reconnect seamlessly after short status cue (1.2s)
            if (autoReconnectTimerRef.current) clearTimeout(autoReconnectTimerRef.current);
            autoReconnectTimerRef.current = setTimeout(() => {
              startMatching(currentCampusesRef.current, currentRadiusRef.current);
            }, 1200);
          } else if (data.type === "error") {
            setStatusMessage(data.message);
          }
        } catch (e) {
          console.error("Room WS Parse Error:", e);
        }
      };

      ws.onclose = () => {
        setChatState((prev) => {
          if (prev === "MATCHED") {
            if (activeMatchIdRef.current) {
              updateMatchLogEnd(activeMatchIdRef.current, "disconnect");
            }
            setPartnerLeaveReason("disconnect");
            setStatusMessage("Partner disconnected. Re-connecting...");
            setMessages((msgs) => [
              ...msgs,
              {
                id: `sys_${Date.now()}`,
                senderId: "system",
                isSelf: false,
                text: "⚠️ Partner disconnected. Re-connecting to next person...",
                timestamp: Date.now(),
              },
            ]);

            // Auto-reconnect
            if (autoReconnectTimerRef.current) clearTimeout(autoReconnectTimerRef.current);
            autoReconnectTimerRef.current = setTimeout(() => {
              startMatching(currentCampusesRef.current, currentRadiusRef.current);
            }, 1200);

            return "PARTNER_SKIPPED";
          }
          return prev;
        });
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

      const wsUrl = `${getWsBaseUrl("/ws/queue")}?userId=${encodeURIComponent(
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
            activeMatchIdRef.current = data.matchId;

            // Save to 24h recent match logs
            saveMatchLog({
              matchId: data.matchId,
              partnerUserId: data.partner.userId,
              partnerDisplayName: data.partner.displayName,
              campusId: data.campusId,
              matchedAt: Date.now(),
            });

            setPartner({
              userId: data.partner.userId,
              displayName: data.partner.displayName,
              distanceMeters: data.distanceMeters,
              campusId: data.campusId,
            });
            connectToRoom(data.matchId);
          } else if (data.type === "queue_joined") {
            setStatusMessage(data.message);
            if (typeof data.queueCount === "number") {
              setQueueCount(data.queueCount);
            }
            if (typeof data.onlineCount === "number") {
              setOnlineCount(data.onlineCount);
            }
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
    if (activeMatchIdRef.current) {
      updateMatchLogEnd(activeMatchIdRef.current, "self_skip");
    }
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
    if (autoReconnectTimerRef.current) {
      clearTimeout(autoReconnectTimerRef.current);
      autoReconnectTimerRef.current = null;
    }
    if (activeMatchIdRef.current) {
      updateMatchLogEnd(activeMatchIdRef.current, "self_leave");
    }
    if (wsRef.current && chatState === "MATCHED") {
      try {
        wsRef.current.send(JSON.stringify({ type: "leave" }));
      } catch (e) {
        console.error("Leave send error:", e);
      }
    }
    closeCurrentSocket();
    setChatState("IDLE");
    setMessages([]);
    setPartner(null);
    setCurrentMatchId(null);
    setStatusMessage("");
    setPartnerLeaveReason(null);
  }, [chatState, closeCurrentSocket]);

  // Block partner
  const blockPartner = useCallback(
    async (targetId?: string) => {
      const idToBlock = targetId || partner?.userId;
      if (!idToBlock || !token) return false;
      try {
        const res = await fetch("/api/blocks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ targetUserId: idToBlock }),
        });
        if (res.ok) {
          if (!targetId || targetId === partner?.userId) {
            skip();
          }
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [partner, token, skip]
  );

  // Report partner (Active match)
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
          markMatchReported(currentMatchId);
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

  // Report a past match from the 24-hour log
  const reportPastMatch = useCallback(
    async (matchId: string, reportedUserId: string, reason: ReportReason, details?: string) => {
      if (!token) return false;
      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reportedUserId,
            matchId,
            reason,
            details,
          }),
        });

        if (res.ok) {
          markMatchReported(matchId);
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [token]
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
    partnerLeaveReason,
    queueCount,
    onlineCount,
    setOnlineCount,
    startMatching,
    sendMessage,
    skip,
    leave,
    blockPartner,
    reportPartner,
    reportPastMatch,
  };
}
