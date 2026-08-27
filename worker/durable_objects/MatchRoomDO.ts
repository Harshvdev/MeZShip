import { DurableObject } from "cloudflare:workers";
import type { Env } from "../types";

interface MessageRateBucket {
  timestamps: number[];
}

interface MatchContext {
  matchId: string;
  userA: string;
  userB: string;
  createdAt: number;
  endedAt: number | null;
}

interface SocketAttachment {
  socketId: string;
  userId: string;
  displayName: string;
  matchId: string;
}

export class MatchRoomDO extends DurableObject<Env> {
  private rateLimits: Map<string, MessageRateBucket> = new Map();
  private matchContext: MatchContext | null = null;
  private pendingMessages: Array<{ payload: string; senderId: string }> = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async getMatchContext(): Promise<MatchContext | null> {
    if (!this.matchContext) {
      this.matchContext = (await this.ctx.storage.get<MatchContext>("matchContext")) || null;
    }
    return this.matchContext;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 0. Initialize match context directly from CampusMatcherDO (atomic & eliminates race condition)
    if (url.pathname === "/init_match" && request.method === "POST") {
      try {
        const body: { matchId: string; userA: string; userB: string } = await request.json();
        let matchCtx = await this.getMatchContext();
        if (!matchCtx) {
          matchCtx = {
            matchId: body.matchId,
            userA: body.userA,
            userB: body.userB,
            createdAt: Date.now(),
            endedAt: null,
          };
          this.matchContext = matchCtx;
          await this.ctx.storage.put("matchContext", matchCtx);
        }
        return new Response(JSON.stringify({ success: true, matchContext: this.matchContext }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
      }
    }

    // 1. WebSocket Upgrade for active chat session
    if (request.headers.get("Upgrade") === "websocket") {
      const userId = url.searchParams.get("userId") || "";
      const displayName = url.searchParams.get("displayName") || "Anonymous";
      const matchId = url.searchParams.get("matchId") || "";

      if (!userId || !matchId) {
        return new Response("Missing parameters", { status: 400 });
      }

      let matchCtx = await this.getMatchContext();

      // Check if match session has already ended
      if (matchCtx && matchCtx.endedAt !== null) {
        return new Response("Match session has already ended", { status: 410 });
      }

      // Check participant authorization & enforce strict 2-user capacity
      if (!matchCtx) {
        matchCtx = {
          matchId,
          userA: userId,
          userB: "",
          createdAt: Date.now(),
          endedAt: null,
        };
        this.matchContext = matchCtx;
        await this.ctx.storage.put("matchContext", matchCtx);
      } else if (!matchCtx.userB && matchCtx.userA !== userId) {
        matchCtx.userB = userId;
        this.matchContext = matchCtx;
        await this.ctx.storage.put("matchContext", matchCtx);
      } else if (userId !== matchCtx.userA && userId !== matchCtx.userB) {
        return new Response("Unauthorized: Match room is full (maximum 2 participants)", { status: 403 });
      }

      // Deduplicate active sockets for this user in this room (close any older socket for this user)
      const existingSockets = this.ctx.getWebSockets(userId);
      for (const oldWs of existingSockets) {
        try {
          oldWs.serializeAttachment(null);
          oldWs.close(1000, "Replaced by newer room connection");
        } catch {}
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Persist unique socketId in attachment on server WebSocket for hibernation resilience
      const socketId = `ws_${crypto.randomUUID()}`;
      const attachment: SocketAttachment = { socketId, userId, displayName, matchId };
      server.serializeAttachment(attachment);
      this.ctx.acceptWebSocket(server, [userId, socketId]);

      // If both participants are connected, broadcast connected notification on next microtask after 101 handshake completes
      queueMicrotask(() => {
        try {
          server.send(
            JSON.stringify({
              type: "chat_ready",
              matchId,
              userId,
            })
          );

          // Replay any buffered messages sent by partner before this user joined
          if (this.pendingMessages.length > 0) {
            const remaining: Array<{ payload: string; senderId: string }> = [];
            for (const item of this.pendingMessages) {
              if (item.senderId !== userId) {
                try {
                  server.send(item.payload);
                } catch {}
              } else {
                remaining.push(item);
              }
            }
            this.pendingMessages = remaining;
          }

          const activeSockets = this.ctx.getWebSockets();
          const uniqueUserIds = new Set<string>();
          for (const s of activeSockets) {
            if (s.readyState === 1) {
              const att = s.deserializeAttachment() as SocketAttachment | null;
              if (att?.userId) uniqueUserIds.add(att.userId);
            }
          }
          if (uniqueUserIds.size >= 2) {
            this.broadcast({
              type: "partner_connected",
              message: "You are now chatting! Say hello.",
            });
          }
        } catch (e) {
          console.error("Partner connected broadcast error:", e);
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // 2. Context verification endpoint for context-bound reporting
    if (url.pathname === "/verify_match" && request.method === "POST") {
      const body: { reporterId: string; reportedId: string } = await request.json();
      const matchCtx = await this.getMatchContext();

      if (!matchCtx) {
        return new Response(JSON.stringify({ valid: false, reason: "Match not found" }), {
          status: 404,
        });
      }

      const { userA, userB, endedAt } = matchCtx;
      const isParticipants =
        (userA === body.reporterId && userB === body.reportedId) ||
        (userB === body.reporterId && userA === body.reportedId);

      if (!isParticipants) {
        return new Response(
          JSON.stringify({ valid: false, reason: "Users were not matched in this room" }),
          { status: 400 }
        );
      }

      // Check grace period: valid if active or ended within last 24 hours (86,400,000 ms)
      if (endedAt && Date.now() - endedAt > 86400000) {
        return new Response(
          JSON.stringify({ valid: false, reason: "Reporting window expired (24 hours exceeded)" }),
          { status: 400 }
        );
      }

      return new Response(JSON.stringify({ valid: true, matchId: matchCtx.matchId }), {
        status: 200,
      });
    }

    // 3. Room termination endpoint when reported or blocked
    if (url.pathname === "/end_room" && request.method === "POST") {
      try {
        const body: { reason?: string; initiatorId?: string } = await request.json();
        const matchCtx = await this.getMatchContext();
        if (matchCtx && !matchCtx.endedAt) {
          matchCtx.endedAt = Date.now();
          await this.ctx.storage.put("matchContext", matchCtx);
        }
        this.broadcast({
          type: "partner_skipped",
          reason: body.reason === "reported" ? "leave" : "disconnect",
          message: "The chat session has ended.",
        });
        const sockets = this.ctx.getWebSockets();
        for (const ws of sockets) {
          try {
            ws.close(1000, "Session ended");
          } catch {}
        }
        return new Response(JSON.stringify({ success: true }));
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500 });
      }
    }

    return new Response("MatchRoomDO Active", { status: 200 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = typeof message === "string" ? JSON.parse(message) : {};

      // Keepalive ping/pong handler
      if (data.type === "ping") {
        try {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        } catch {}
        return;
      }

      const attachment = ws.deserializeAttachment() as SocketAttachment | null;
      const currentSocketId = attachment?.socketId;
      const senderTags = this.ctx.getTags(ws);
      const senderId = senderTags[0] || attachment?.userId || "";

      if (!senderId) return;

      const matchCtx = await this.getMatchContext();
      if (!matchCtx || matchCtx.endedAt !== null) return;
      if (senderId !== matchCtx.userA && senderId !== matchCtx.userB) return;

      if (data.type === "message") {
        const text = (data.text || "").trim();
        if (!text) return;

        // Message length limit (max 500 characters)
        if (text.length > 500) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Message exceeds maximum allowed length (500 chars).",
            })
          );
          return;
        }

        // Rate limiting: max 10 messages per 5 seconds sliding window
        if (!this.checkRateLimit(senderId)) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Rate limit exceeded. Please slow down.",
            })
          );
          return;
        }

        const msgId = `msg_${crypto.randomUUID()}`;
        const now = Date.now();

        // Forward to other participant(s)
        const payload = JSON.stringify({
          type: "message",
          id: msgId,
          senderId,
          text,
          timestamp: now,
        });

        const activeSockets = this.ctx.getWebSockets();
        let forwardedToOther = false;
        for (const socket of activeSockets) {
          if (socket.readyState !== 1) continue;
          const targetAttachment = socket.deserializeAttachment() as SocketAttachment | null;
          const isCurrentSocket = currentSocketId
            ? targetAttachment?.socketId === currentSocketId
            : socket === ws;

          if (!isCurrentSocket) {
            try {
              socket.send(payload);
              forwardedToOther = true;
            } catch (e) {
              console.error("Message forwarding error:", e);
            }
          }
        }

        // If partner has not yet completed WebSocket handshake, buffer message to replay upon connection
        if (!forwardedToOther) {
          if (this.pendingMessages.length < 20) {
            this.pendingMessages.push({ payload, senderId });
          }
        }

        // Always acknowledge receipt directly to sender socket
        if (data.clientMsgId) {
          try {
            ws.send(
              JSON.stringify({
                type: "message_ack",
                clientMsgId: data.clientMsgId,
                id: msgId,
                timestamp: now,
              })
            );
          } catch (e) {
            console.error("Ack send error:", e);
          }
        }
      } else if (data.type === "reaction") {
        const messageId = String(data.messageId || "").trim();
        const emoji = String(data.emoji || "").trim();
        if (!messageId || !emoji) return;

        const payload = JSON.stringify({
          type: "reaction",
          messageId,
          emoji,
          senderId,
        });

        const activeSockets = this.ctx.getWebSockets();
        for (const socket of activeSockets) {
          const targetAttachment = socket.deserializeAttachment() as SocketAttachment | null;
          const isCurrentSocket = currentSocketId
            ? targetAttachment?.socketId === currentSocketId
            : socket === ws;

          if (!isCurrentSocket) {
            try {
              socket.send(payload);
            } catch (e) {
              console.error("Reaction forwarding error:", e);
            }
          }
        }
      } else if (data.type === "typing_start" || data.type === "typing_stop") {
        const payload = JSON.stringify({
          type: data.type,
          senderId,
        });
        const activeSockets = this.ctx.getWebSockets();
        for (const socket of activeSockets) {
          const targetTags = this.ctx.getTags(socket);
          const targetAttachment = socket.deserializeAttachment() as SocketAttachment | null;
          const targetSocketId = targetTags[1] || targetAttachment?.socketId;

          const isCurrentSocket =
            socket === ws ||
            (currentSocketId && targetSocketId && targetSocketId === currentSocketId);

          if (!isCurrentSocket) {
            try {
              socket.send(payload);
            } catch (e) {
              console.error("Typing forwarding error:", e);
            }
          }
        }
      } else if (data.type === "skip") {
        await this.handleSkip(ws, senderId, "skip");
      } else if (data.type === "leave") {
        await this.handleSkip(ws, senderId, "leave");
      }
    } catch (err) {
      console.error("MatchRoom WS error:", err);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    // If attachment was explicitly cleared (e.g. replaced by newer connection or cleanly detached), ignore
    if (!attachment || !attachment.userId) {
      return;
    }

    const userId = attachment.userId;
    // Clear attachment so it won't be reused
    try {
      ws.serializeAttachment(null);
    } catch {}

    // Check if this user still has active sockets in this room (e.g. fast reconnection/replacement)
    const remainingSockets = this.ctx.getWebSockets(userId);
    const hasOtherActiveSocket = remainingSockets.some((s) => {
      if (s === ws) return false;
      const att = s.deserializeAttachment() as SocketAttachment | null;
      return Boolean(att && att.userId === userId);
    });

    if (hasOtherActiveSocket) {
      // User is still connected on another socket in this room
      return;
    }

    await this.handleSkip(ws, userId, "disconnect");
  }

  private async handleSkip(sourceWs: WebSocket, initiatorId: string, reason: "skip" | "leave" | "disconnect" = "skip") {
    const matchCtx = await this.getMatchContext();
    if (matchCtx && !matchCtx.endedAt) {
      matchCtx.endedAt = Date.now();
      try {
        await this.ctx.storage.put("matchContext", matchCtx);
      } catch {}
    }

    let defaultMsg = "Your partner skipped the chat.";
    if (reason === "leave") {
      defaultMsg = "Your partner left the conversation.";
    } else if (reason === "disconnect") {
      defaultMsg = "Your partner disconnected.";
    }

    const payload = JSON.stringify({
      type: "partner_skipped",
      reason,
      message: defaultMsg,
    });

    // Notify other connected sockets
    const sourceAttachment = sourceWs.deserializeAttachment() as SocketAttachment | null;
    const sourceSocketId = sourceAttachment?.socketId;
    const activeSockets = this.ctx.getWebSockets();
    for (const socket of activeSockets) {
      const targetAttachment = socket.deserializeAttachment() as SocketAttachment | null;
      const isSource = sourceSocketId
        ? targetAttachment?.socketId === sourceSocketId
        : socket === sourceWs;

      if (!isSource) {
        try {
          socket.send(payload);
        } catch (e) {
          console.error("Error notifying skipped partner:", e);
        }
      }
    }
  }

  private broadcast(payload: any) {
    const msg = JSON.stringify(payload);
    const activeSockets = this.ctx.getWebSockets();
    for (const socket of activeSockets) {
      try {
        socket.send(msg);
      } catch (e) {
        console.error("Broadcast error:", e);
      }
    }
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    let bucket = this.rateLimits.get(userId);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.rateLimits.set(userId, bucket);
    }

    // Keep timestamps in the last 5000ms
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < 5000);

    if (bucket.timestamps.length >= 10) {
      return false;
    }

    bucket.timestamps.push(now);
    return true;
  }
}
