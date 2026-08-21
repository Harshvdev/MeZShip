"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WebSocketServerMessage, ReportReason } from "@/lib/protocol";
import { saveMatchLog, updateMatchLogEnd, markMatchReported } from "@/lib/matchLogs";
import { getApiUrl } from "@/lib/api";

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
  status?: "sending" | "sent" | "failed";
  clientMsgId?: string;
  reactions?: Record<string, string[]>; // emoji -> array of userIds
}

function toggleEmojiInReactions(
  reactions: Record<string, string[]> | undefined,
  emoji: string,
  userId: string
): Record<string, string[]> {
  const current = { ...(reactions || {}) };
  const userList = current[emoji] ? [...current[emoji]] : [];
  const idx = userList.indexOf(userId);
  if (idx !== -1) {
    userList.splice(idx, 1);
  } else {
    userList.push(userId);
  }

  if (userList.length === 0) {
    delete current[emoji];
  } else {
    current[emoji] = userList;
  }
  return current;
}

export interface PartnerInfo {
  userId: string;
  displayName: string;
  distanceMeters: number;
  hasPreciseDistance?: boolean;
  campusId?: string;
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
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [isPartnerTyping, setIsPartnerTyping] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const currentRadiusRef = useRef<number>(5000);
  const userLatRef = useRef<number | null>(userLat);
  const userLngRef = useRef<number | null>(userLng);
  const activeMatchIdRef = useRef<string | null>(null);
  const autoReconnectTimerRef = useRef<any>(null);
  const pingIntervalRef = useRef<any>(null);
  const watchdogIntervalRef = useRef<any>(null);
  const lastHeartbeatResponseRef = useRef<number>(Date.now());
  const partnerTypingTimeoutRef = useRef<any>(null);
  const clientTypingTimeoutRef = useRef<any>(null);
  const isClientTypingRef = useRef<boolean>(false);
  const lastTypingSentRef = useRef<number>(0);
  const pendingAcksRef = useRef<Map<string, any>>(new Map());

  // Keep refs synced and broadcast location updates while waiting in queue
  useEffect(() => {
    userLatRef.current = userLat;
    userLngRef.current = userLng;

    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      chatState === "SEARCHING" &&
      userLat !== null &&
      userLng !== null
    ) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: "update_location",
            lat: userLat,
            lng: userLng,
            radius: currentRadiusRef.current,
          })
        );
      } catch (err) {
        console.error("Failed to send update_location:", err);
      }
    }
  }, [userLat, userLng, chatState]);

  const getWsBaseUrl = (path: string) => {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;

    // 1. Explicit WebSocket URL (Production wss:// or Local ws://)
    if (process.env.NEXT_PUBLIC_WS_URL) {
      const base = process.env.NEXT_PUBLIC_WS_URL.trim()
        .replace(/['"]+/g, "")
        .replace(/localhost/g, "127.0.0.1")
        .replace(/\/+$/, "");
      return `${base}${cleanPath}`;
    }

    // 2. Derive WebSocket URL from Worker HTTP/HTTPS URL
    if (process.env.NEXT_PUBLIC_WORKER_URL) {
      const base = process.env.NEXT_PUBLIC_WORKER_URL.trim()
        .replace(/['"]+/g, "")
        .replace(/localhost/g, "127.0.0.1")
        .replace(/^https:\/\//i, "wss://")
        .replace(/^http:\/\//i, "ws://")
        .replace(/\/+$/, "");
      return `${base}${cleanPath}`;
    }

    // 3. Fallback based on client window location
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const isLocal =
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("10.") ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
      if (isLocal) {
        const resolvedHost = hostname === "localhost" ? "127.0.0.1" : hostname;
        return `ws://${resolvedHost}:8787${cleanPath}`;
      }
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host.replace(/^localhost(?=:|$)/, "127.0.0.1");
      return `${protocol}//${host}${cleanPath}`;
    }

    return `ws://127.0.0.1:8787${cleanPath}`;
  };

  const closeCurrentSocket = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }
    if (autoReconnectTimerRef.current) {
      clearTimeout(autoReconnectTimerRef.current);
      autoReconnectTimerRef.current = null;
    }
    if (partnerTypingTimeoutRef.current) {
      clearTimeout(partnerTypingTimeoutRef.current);
      partnerTypingTimeoutRef.current = null;
    }
    if (clientTypingTimeoutRef.current) {
      clearTimeout(clientTypingTimeoutRef.current);
      clientTypingTimeoutRef.current = null;
    }
    isClientTypingRef.current = false;
    lastTypingSentRef.current = 0;
    setIsPartnerTyping(false);

    pendingAcksRef.current.forEach((timer) => clearTimeout(timer));
    pendingAcksRef.current.clear();

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

  const startHeartbeat = useCallback((ws: WebSocket) => {
    lastHeartbeatResponseRef.current = Date.now();

    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "ping" }));
        } catch (e) {
          console.warn("Ping send error:", e);
        }
      }
    }, 20000);

    if (watchdogIntervalRef.current) clearInterval(watchdogIntervalRef.current);
    watchdogIntervalRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        if (Date.now() - lastHeartbeatResponseRef.current > 45000) {
          console.warn("WebSocket watchdog timeout: no traffic in 45s. Reconnecting...");
          try {
            ws.close();
          } catch {}
        }
      }
    }, 5000);
  }, []);

  const sendTyping = useCallback(
    (typing: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      if (typing) {
        const now = Date.now();
        // Send typing_start immediately or if last pulse was > 1800ms ago
        if (!isClientTypingRef.current || now - lastTypingSentRef.current > 1800) {
          isClientTypingRef.current = true;
          lastTypingSentRef.current = now;
          try {
            wsRef.current.send(JSON.stringify({ type: "typing_start" }));
          } catch {}
        }

        if (clientTypingTimeoutRef.current) clearTimeout(clientTypingTimeoutRef.current);
        clientTypingTimeoutRef.current = setTimeout(() => {
          if (isClientTypingRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            isClientTypingRef.current = false;
            try {
              wsRef.current.send(JSON.stringify({ type: "typing_stop" }));
            } catch {}
          }
        }, 1500);
      } else {
        if (clientTypingTimeoutRef.current) {
          clearTimeout(clientTypingTimeoutRef.current);
          clientTypingTimeoutRef.current = null;
        }
        if (isClientTypingRef.current) {
          isClientTypingRef.current = false;
          try {
            wsRef.current.send(JSON.stringify({ type: "typing_stop" }));
          } catch {}
        }
      }
    },
    []
  );

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
        startHeartbeat(ws);
      };

      ws.onmessage = (event) => {
        try {
          lastHeartbeatResponseRef.current = Date.now();
          const data: WebSocketServerMessage = JSON.parse(event.data);

          if (data.type === "pong") return;

          if (data.type === "chat_ready") {
            setChatState("MATCHED");
            setStatusMessage("Connected! Start chatting.");
            setIsPartnerTyping(false);
          } else if (data.type === "partner_connected") {
            setStatusMessage("Partner connected. Say hi!");
          } else if (data.type === "message") {
            setIsPartnerTyping(false);
            if (partnerTypingTimeoutRef.current) {
              clearTimeout(partnerTypingTimeoutRef.current);
              partnerTypingTimeoutRef.current = null;
            }
            setMessages((prev) => {
              // If this message was echoed back from our own send, reconcile optimistic message
              const pendingIdx = prev.findIndex(
                (m) => m.isSelf && m.status === "sending" && m.text === data.text
              );
              if (pendingIdx !== -1 && data.senderId === userId) {
                const updated = [...prev];
                const pending = updated[pendingIdx];
                if (pending.clientMsgId) {
                  const timer = pendingAcksRef.current.get(pending.clientMsgId);
                  if (timer) {
                    clearTimeout(timer);
                    pendingAcksRef.current.delete(pending.clientMsgId);
                  }
                }
                updated[pendingIdx] = {
                  ...pending,
                  id: data.id,
                  timestamp: data.timestamp,
                  status: "sent",
                };
                return updated;
              }

              // Deduplicate by id if already in array
              if (prev.some((m) => m.id === data.id)) {
                return prev;
              }

              return [
                ...prev,
                {
                  id: data.id,
                  senderId: data.senderId,
                  isSelf: data.senderId === userId,
                  text: data.text,
                  timestamp: data.timestamp,
                  status: "sent",
                },
              ];
            });
          } else if (data.type === "message_ack") {
            const { clientMsgId, id, timestamp } = data;
            const timer = pendingAcksRef.current.get(clientMsgId);
            if (timer) {
              clearTimeout(timer);
              pendingAcksRef.current.delete(clientMsgId);
            }
            setMessages((prev) =>
              prev.map((msg) =>
                msg.clientMsgId === clientMsgId || msg.id === clientMsgId
                  ? { ...msg, id, timestamp, status: "sent" }
                  : msg
              )
            );
          } else if (data.type === "reaction") {
            const { messageId, emoji, senderId } = data;
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === messageId || msg.clientMsgId === messageId) {
                  const nextReactions = toggleEmojiInReactions(msg.reactions, emoji, senderId);
                  return { ...msg, reactions: nextReactions };
                }
                return msg;
              })
            );
          } else if (data.type === "typing_start") {
            setIsPartnerTyping(true);
            if (partnerTypingTimeoutRef.current) clearTimeout(partnerTypingTimeoutRef.current);
            partnerTypingTimeoutRef.current = setTimeout(() => {
              setIsPartnerTyping(false);
            }, 3000);
          } else if (data.type === "typing_stop") {
            setIsPartnerTyping(false);
            if (partnerTypingTimeoutRef.current) {
              clearTimeout(partnerTypingTimeoutRef.current);
              partnerTypingTimeoutRef.current = null;
            }
          } else if (data.type === "partner_skipped") {
            setIsPartnerTyping(false);
            if (partnerTypingTimeoutRef.current) {
              clearTimeout(partnerTypingTimeoutRef.current);
              partnerTypingTimeoutRef.current = null;
            }
            setPartnerLeaveReason(data.reason || "skip");
            setChatState("PARTNER_SKIPPED");
            if (data.reason === "leave") {
              setStatusMessage("Partner left the chat.");
            } else if (data.reason === "disconnect") {
              setStatusMessage("Partner disconnected.");
            } else {
              setStatusMessage("Partner skipped. Searching for next match...");
            }

            if (activeMatchIdRef.current) {
              updateMatchLogEnd(activeMatchIdRef.current, data.reason || "skip");
            }

            if (data.reason === "skip" || data.reason === "disconnect") {
              if (autoReconnectTimerRef.current) clearTimeout(autoReconnectTimerRef.current);
              autoReconnectTimerRef.current = setTimeout(() => {
                startMatching(currentRadiusRef.current);
              }, 600);
            }
          }
        } catch (e) {
          console.error("Room WS Parse error:", e);
        }
      };

      ws.onclose = (event) => {
        setIsPartnerTyping(false);
        setMessages((prev) =>
          prev.map((m) => (m.status === "sending" ? { ...m, status: "failed" } : m))
        );
        pendingAcksRef.current.forEach((t) => clearTimeout(t));
        pendingAcksRef.current.clear();

        setChatState((prev) => {
          if (prev === "MATCHED") {
            setStatusMessage("Disconnected from room. Finding next partner...");
            if (activeMatchIdRef.current) {
              updateMatchLogEnd(activeMatchIdRef.current, "disconnect");
            }
            if (autoReconnectTimerRef.current) clearTimeout(autoReconnectTimerRef.current);
            autoReconnectTimerRef.current = setTimeout(() => {
              startMatching(currentRadiusRef.current);
            }, 250);

            return "PARTNER_SKIPPED";
          }
          return prev;
        });
      };

      ws.onerror = (err) => {
        console.error("Room WS error:", err);
        setMessages((prev) =>
          prev.map((m) => (m.status === "sending" ? { ...m, status: "failed" } : m))
        );
        pendingAcksRef.current.forEach((t) => clearTimeout(t));
        pendingAcksRef.current.clear();
      };
    },
    [userId, displayName, token, closeCurrentSocket, startHeartbeat]
  );

  const startMatching = useCallback(
    (radius = 5000) => {
      if (!userId || !token) {
        setStatusMessage("Authenticating session...");
        return;
      }
      closeCurrentSocket();

      currentRadiusRef.current = radius;
      setMessages([]);
      setPartner(null);
      setCurrentMatchId(null);
      setIsPartnerTyping(false);
      setChatState("SEARCHING");
      const radiusKm = (radius / 1000).toFixed(0);
      setStatusMessage(`Searching for nearby users within ${radiusKm} km...`);

      const latToSend = userLatRef.current ?? userLat ?? 0;
      const lngToSend = userLngRef.current ?? userLng ?? 0;

      const wsUrl = `${getWsBaseUrl("/ws/queue")}?userId=${encodeURIComponent(
        userId
      )}&displayName=${encodeURIComponent(
        displayName || "Anonymous"
      )}&lat=${latToSend}&lng=${lngToSend}&radius=${radius}&token=${encodeURIComponent(token || "")}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        startHeartbeat(ws);
      };

      ws.onmessage = (event) => {
        try {
          lastHeartbeatResponseRef.current = Date.now();
          const data: WebSocketServerMessage = JSON.parse(event.data);

          if (data.type === "pong") return;

          if (data.type === "match_found") {
            setCurrentMatchId(data.matchId);
            activeMatchIdRef.current = data.matchId;

            saveMatchLog({
              matchId: data.matchId,
              partnerUserId: data.partner.userId,
              partnerDisplayName: data.partner.displayName,
              distanceMeters: data.distanceMeters,
              hasPreciseDistance: data.hasPreciseDistance,
              campusId: data.campusId || "nearby",
              matchedAt: Date.now(),
            });

            setPartner({
              userId: data.partner.userId,
              displayName: data.partner.displayName,
              distanceMeters: data.distanceMeters,
              hasPreciseDistance: data.hasPreciseDistance,
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
    [userId, displayName, token, userLat, userLng, closeCurrentSocket, connectToRoom, startHeartbeat]
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || chatState !== "MATCHED") return;

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setStatusMessage("Connection interrupted. Reconnecting...");
        return;
      }

      sendTyping(false);

      const clientMsgId = `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = Date.now();

      setMessages((prev) => [
        ...prev,
        {
          id: clientMsgId,
          clientMsgId,
          senderId: userId || "",
          isSelf: true,
          text: trimmed,
          timestamp: now,
          status: "sending",
        },
      ]);

      const timer = setTimeout(() => {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.clientMsgId === clientMsgId && msg.status === "sending") {
              // If websocket remained healthy and open, message was transmitted successfully
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                return { ...msg, status: "sent" };
              }
              return { ...msg, status: "failed" };
            }
            return msg;
          })
        );
        pendingAcksRef.current.delete(clientMsgId);
      }, 800);
      pendingAcksRef.current.set(clientMsgId, timer);

      try {
        wsRef.current.send(
          JSON.stringify({
            type: "message",
            text: trimmed,
            clientMsgId,
          })
        );
      } catch (err) {
        console.error("Failed to send message:", err);
        clearTimeout(timer);
        pendingAcksRef.current.delete(clientMsgId);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.clientMsgId === clientMsgId ? { ...msg, status: "failed" } : msg
          )
        );
      }
    },
    [userId, chatState, sendTyping]
  );

  const skip = useCallback(() => {
    sendTyping(false);
    if (activeMatchIdRef.current) {
      updateMatchLogEnd(activeMatchIdRef.current, "self_skip");
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && chatState === "MATCHED") {
      try {
        wsRef.current.send(JSON.stringify({ type: "skip" }));
      } catch (e) {
        console.error("Skip send error:", e);
      }
    }
    startMatching(currentRadiusRef.current);
  }, [chatState, sendTyping, startMatching]);

  const leave = useCallback(() => {
    sendTyping(false);
    if (autoReconnectTimerRef.current) {
      clearTimeout(autoReconnectTimerRef.current);
      autoReconnectTimerRef.current = null;
    }
    if (activeMatchIdRef.current) {
      updateMatchLogEnd(activeMatchIdRef.current, "self_leave");
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && chatState === "MATCHED") {
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
    setIsPartnerTyping(false);
  }, [chatState, sendTyping, closeCurrentSocket]);

  const blockPartner = useCallback(
    async (targetId?: string) => {
      const idToBlock = targetId || partner?.userId;
      if (!idToBlock || !token) return false;
      try {
        const res = await fetch(getApiUrl("/api/blocks"), {
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
    [partner?.userId, token, skip]
  );

  const reportPartner = useCallback(
    async (reason: ReportReason, details?: string) => {
      if (!partner?.userId || !currentMatchId || !token) return false;
      try {
        const res = await fetch(getApiUrl("/api/reports"), {
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
    [partner?.userId, currentMatchId, token, skip]
  );

  const reportPastMatch = useCallback(
    async (matchId: string, reportedUserId: string, reason: ReportReason, details?: string) => {
      if (!token) return false;
      try {
        const res = await fetch(getApiUrl("/api/reports"), {
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

  // Toggle a reaction emoji on a message
  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!userId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      // Optimistically update local message state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === messageId || msg.clientMsgId === messageId) {
            const nextReactions = toggleEmojiInReactions(msg.reactions, emoji, userId);
            return { ...msg, reactions: nextReactions };
          }
          return msg;
        })
      );

      try {
        wsRef.current.send(
          JSON.stringify({
            type: "reaction",
            messageId,
            emoji,
          })
        );
      } catch (err) {
        console.error("Failed to send reaction:", err);
      }
    },
    [userId]
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
    isPartnerTyping,
    setOnlineCount,
    startMatching,
    sendMessage,
    sendTyping,
    toggleReaction,
    skip,
    leave,
    blockPartner,
    reportPartner,
    reportPastMatch,
  };
}
