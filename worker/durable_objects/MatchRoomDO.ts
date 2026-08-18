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

    // 1. WebSocket Upgrade for active chat session
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = url.searchParams.get("userId") || "";
      const displayName = url.searchParams.get("displayName") || "Anonymous";
      const matchId = url.searchParams.get("matchId") || "";

      if (!userId || !matchId) {
        return new Response("Missing parameters", { status: 400 });
      }

      // Persist unique socketId in attachment on server WebSocket for hibernation resilience
      const socketId = `ws_${crypto.randomUUID()}`;
      const attachment: SocketAttachment = { socketId, userId, displayName, matchId };
      server.serializeAttachment(attachment);
      this.ctx.acceptWebSocket(server, [userId, socketId]);

      let matchCtx = await this.getMatchContext();
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
      }

      server.send(
        JSON.stringify({
          type: "chat_ready",
          matchId,
          userId,
        })
      );

      // If both participants are connected, broadcast connected notification
      const activeSockets = this.ctx.getWebSockets();
      if (activeSockets.length >= 2) {
        this.broadcast({
          type: "partner_connected",
          message: "You are now chatting! Say hello.",
        });
      }

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
        for (const socket of activeSockets) {
          const targetAttachment = socket.deserializeAttachment() as SocketAttachment | null;
          const isCurrentSocket = currentSocketId
            ? targetAttachment?.socketId === currentSocketId
            : socket === ws;

          if (!isCurrentSocket) {
            try {
              socket.send(payload);
            } catch (e) {
              console.error("Message forwarding error:", e);
            }
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
      } else if (data.type === "typing_start") {
        const payload = JSON.stringify({
          type: "typing_start",
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
            } catch {}
          }
        }
      } else if (data.type === "typing_stop") {
        const payload = JSON.stringify({
          type: "typing_stop",
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
            } catch {}
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
    const senderTags = this.ctx.getTags(ws);
    let senderId = senderTags[0];
    if (!senderId) {
      const attachment = ws.deserializeAttachment() as SocketAttachment | null;
      senderId = attachment?.userId || "";
    }
    await this.handleSkip(ws, senderId, "disconnect");
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
