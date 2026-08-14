import { DurableObject } from "cloudflare:workers";
import type { Env } from "../types";

interface SessionParticipant {
  ws: WebSocket;
  userId: string;
  displayName: string;
}

interface MessageRateBucket {
  timestamps: number[];
}

export class MatchRoomDO extends DurableObject<Env> {
  private participants: Map<string, SessionParticipant> = new Map();
  private rateLimits: Map<string, MessageRateBucket> = new Map();
  private matchContext: {
    matchId: string;
    userA: string;
    userB: string;
    createdAt: number;
    endedAt: number | null;
  } | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
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

      this.ctx.acceptWebSocket(server, [userId]);

      this.participants.set(userId, {
        ws: server,
        userId,
        displayName,
      });

      if (!this.matchContext) {
        this.matchContext = {
          matchId,
          userA: userId,
          userB: "",
          createdAt: Date.now(),
          endedAt: null,
        };
      } else if (!this.matchContext.userB && this.matchContext.userA !== userId) {
        this.matchContext.userB = userId;
      }

      server.send(
        JSON.stringify({
          type: "chat_ready",
          matchId,
          userId,
        })
      );

      // If both participants are connected, send connected notification
      if (this.participants.size === 2) {
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
      if (!this.matchContext) {
        return new Response(JSON.stringify({ valid: false, reason: "Match not found" }), {
          status: 404,
        });
      }

      const { userA, userB, endedAt } = this.matchContext;
      const isParticipants =
        (userA === body.reporterId && userB === body.reportedId) ||
        (userB === body.reporterId && userA === body.reportedId);

      if (!isParticipants) {
        return new Response(
          JSON.stringify({ valid: false, reason: "Users were not matched in this room" }),
          { status: 400 }
        );
      }

      // Check grace period: valid if active or ended within last 120 seconds
      if (endedAt && Date.now() - endedAt > 120000) {
        return new Response(
          JSON.stringify({ valid: false, reason: "Reporting window expired" }),
          { status: 400 }
        );
      }

      return new Response(JSON.stringify({ valid: true, matchId: this.matchContext.matchId }), {
        status: 200,
      });
    }

    return new Response("MatchRoomDO Active", { status: 200 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const data = typeof message === "string" ? JSON.parse(message) : {};
      const senderTags = this.ctx.getTags(ws);
      const senderId = senderTags[0];

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

        // Forward to other participant (never persisted to database)
        const payload = JSON.stringify({
          type: "message",
          id: `msg_${crypto.randomUUID()}`,
          senderId,
          text,
          timestamp: Date.now(),
        });

        for (const [id, participant] of this.participants.entries()) {
          if (id !== senderId) {
            try {
              participant.ws.send(payload);
            } catch (e) {
              console.error("Message forwarding error:", e);
            }
          }
        }
      } else if (data.type === "skip") {
        this.handleSkip(senderId, "skip");
      } else if (data.type === "leave") {
        this.handleSkip(senderId, "leave");
      }
    } catch (err) {
      console.error("MatchRoom WS error:", err);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const senderTags = this.ctx.getTags(ws);
    const senderId = senderTags[0];
    if (senderId) {
      if (this.participants.has(senderId)) {
        this.participants.delete(senderId);
        if (this.participants.size > 0) {
          this.handleSkip(senderId, "disconnect");
        }
      }
    }
  }

  private handleSkip(initiatorId: string, reason: "skip" | "leave" | "disconnect" = "skip") {
    if (this.matchContext && !this.matchContext.endedAt) {
      this.matchContext.endedAt = Date.now();
    }

    let defaultMsg = "Your partner skipped the chat.";
    if (reason === "leave") {
      defaultMsg = "Your partner left the conversation.";
    } else if (reason === "disconnect") {
      defaultMsg = "Your partner disconnected.";
    }

    // Notify the other participant that their partner left/skipped
    for (const [id, participant] of this.participants.entries()) {
      if (id !== initiatorId) {
        try {
          participant.ws.send(
            JSON.stringify({
              type: "partner_skipped",
              reason,
              message: defaultMsg,
            })
          );
        } catch (e) {
          console.error("Error notifying skipped partner:", e);
        }
      }
    }

    this.participants.clear();
  }

  private broadcast(payload: any) {
    const msg = JSON.stringify(payload);
    for (const participant of this.participants.values()) {
      try {
        participant.ws.send(msg);
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
