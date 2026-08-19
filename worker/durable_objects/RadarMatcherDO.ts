import { DurableObject } from "cloudflare:workers";
import type { Env, WaitingUser } from "../types";
import { haversineDistanceMeters } from "../lib/geo";

interface QueueEntry {
  ws: WebSocket;
  user: WaitingUser;
}

export class RadarMatcherDO extends DurableObject<Env> {
  private presence: Map<string, number> = new Map(); // userId -> lastSeen timestamp
  private blockPairs: Set<string> = new Set(); // "blocker:blocked"
  private matchHistory: Map<string, Map<string, number>> = new Map(); // userId -> (partnerId -> timestamp)

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private cleanPresence() {
    const cutoff = Date.now() - 45000;
    for (const [userId, ts] of this.presence.entries()) {
      if (ts < cutoff) {
        this.presence.delete(userId);
      }
    }
  }

  private getLastMatchedTime(userA: string, userB: string): number | null {
    const histA = this.matchHistory.get(userA);
    if (histA && histA.has(userB)) {
      return histA.get(userB)!;
    }
    const histB = this.matchHistory.get(userB);
    if (histB && histB.has(userA)) {
      return histB.get(userA)!;
    }
    return null;
  }

  private recordMatch(userA: string, userB: string) {
    const now = Date.now();
    if (!this.matchHistory.has(userA)) this.matchHistory.set(userA, new Map());
    if (!this.matchHistory.has(userB)) this.matchHistory.set(userB, new Map());
    this.matchHistory.get(userA)!.set(userB, now);
    this.matchHistory.get(userB)!.set(userA, now);

    // Prune history older than 24h
    const cutoff = now - 86400000;
    for (const [uid, partners] of this.matchHistory.entries()) {
      for (const [pid, ts] of partners.entries()) {
        if (ts < cutoff) partners.delete(pid);
      }
      if (partners.size === 0) this.matchHistory.delete(uid);
    }
  }

  /**
   * Retrieves active waiting users from WebSockets across DO hibernations.
   * Strictly deduplicates by userId so each user can have at most ONE entry in the queue.
   */
  private getWaitingEntries(): QueueEntry[] {
    const sockets = this.ctx.getWebSockets();
    const userEntryMap = new Map<string, QueueEntry>();

    for (const ws of sockets) {
      try {
        const user = ws.deserializeAttachment() as WaitingUser | null;
        if (user && user.userId) {
          const existing = userEntryMap.get(user.userId);
          if (!existing) {
            userEntryMap.set(user.userId, { ws, user });
          } else {
            // If duplicate active socket for same user exists, keep the newest one and evict the older
            if (user.queuedAt >= existing.user.queuedAt) {
              try {
                existing.ws.serializeAttachment(null);
                existing.ws.close(1000, "Duplicate queue socket evicted");
              } catch {}
              userEntryMap.set(user.userId, { ws, user });
            } else {
              try {
                ws.serializeAttachment(null);
                ws.close(1000, "Duplicate queue socket evicted");
              } catch {}
            }
          }
        }
      } catch {}
    }

    return Array.from(userEntryMap.values());
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade for matchmaking queue
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = url.searchParams.get("userId") || "";
      const displayName = url.searchParams.get("displayName") || "Anonymous";
      const lat = parseFloat(url.searchParams.get("lat") || "0");
      const lng = parseFloat(url.searchParams.get("lng") || "0");
      const maxRadiusMeters = parseFloat(url.searchParams.get("radius") || "5000");

      if (!userId) {
        return new Response("Missing userId", { status: 400 });
      }

      // Evict any existing WebSockets for this user before accepting new one
      const existingUserSockets = this.ctx.getWebSockets(userId);
      for (const oldWs of existingUserSockets) {
        try {
          oldWs.serializeAttachment(null);
          oldWs.close(1000, "Replaced by newer queue connection");
        } catch {}
      }

      const waitingUser: WaitingUser = {
        userId,
        displayName,
        lat,
        lng,
        maxRadiusMeters,
        queuedAt: Date.now(),
      };

      // Hibernation-safe attachment and acceptance
      server.serializeAttachment(waitingUser);
      this.ctx.acceptWebSocket(server, [userId]);

      this.presence.set(userId, Date.now());
      this.cleanPresence();

      const waitingEntries = this.getWaitingEntries();
      const totalOnline = Math.max(0, this.presence.size, waitingEntries.length);
      const otherOnline = Math.max(0, totalOnline - 1);

      // Deliver queue welcome and attempt matching on the next microtask after 101 handshake completes
      queueMicrotask(() => {
        try {
          server.send(
            JSON.stringify({
              type: "queue_joined",
              message: "Searching for a compatible nearby match...",
              queuedAt: waitingUser.queuedAt,
              queueCount: Math.max(0, waitingEntries.length - 1),
              onlineCount: otherOnline,
            })
          );
          this.tryMatch(userId);
        } catch (e) {
          console.error("Match error in queueMicrotask:", e);
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/stats" || url.pathname.endsWith("/stats")) {
      this.cleanPresence();
      const queueCount = this.getWaitingEntries().length;
      const totalOnline = Math.max(0, this.presence.size, queueCount);
      return new Response(
        JSON.stringify({
          onlineCount: totalOnline,
          queueCount,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (url.pathname === "/heartbeat" || url.pathname.endsWith("/heartbeat")) {
      try {
        const body: { userId?: string } = await request.json();
        if (body.userId) {
          this.presence.set(body.userId, Date.now());
        }
      } catch {}
      this.cleanPresence();
      const queueCount = this.getWaitingEntries().length;
      return new Response(
        JSON.stringify({
          onlineCount: Math.max(0, this.presence.size, queueCount),
          queueCount,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/update_blocks" && request.method === "POST") {
      const blocks: Array<{ blocker: string; blocked: string }> = await request.json();
      this.blockPairs.clear();
      for (const b of blocks) {
        this.blockPairs.add(`${b.blocker}:${b.blocked}`);
      }
      return new Response(JSON.stringify({ success: true }));
    }

    return new Response("RadarMatcherDO Active", { status: 200 });
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

      if (data.type === "leave_queue") {
        try {
          ws.serializeAttachment(null);
          ws.send(JSON.stringify({ type: "queue_left" }));
          ws.close(1000, "Left queue");
        } catch {}
      } else if (data.type === "update_location") {
        const current = ws.deserializeAttachment() as WaitingUser | null;
        if (current) {
          const parsedLat = typeof data.lat === "number" ? data.lat : parseFloat(data.lat || "0");
          const parsedLng = typeof data.lng === "number" ? data.lng : parseFloat(data.lng || "0");
          current.lat = !isNaN(parsedLat) ? parsedLat : 0;
          current.lng = !isNaN(parsedLng) ? parsedLng : 0;
          if (data.radius) {
            const parsedRadius = typeof data.radius === "number" ? data.radius : parseFloat(data.radius || "5000");
            current.maxRadiusMeters = !isNaN(parsedRadius) ? parsedRadius : 5000;
          }
          ws.serializeAttachment(current);
          this.tryMatch(current.userId);
        }
      }
    } catch (e) {
      console.error("Queue WS Message error:", e);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    try {
      ws.serializeAttachment(null);
    } catch {}
  }

  private isBlocked(userA: string, userB: string): boolean {
    return (
      this.blockPairs.has(`${userA}:${userB}`) ||
      this.blockPairs.has(`${userB}:${userA}`)
    );
  }

  private tryMatch(candidateId: string) {
    const waitingEntries = this.getWaitingEntries();
    const candidateEntry = waitingEntries.find((e) => e.user.userId === candidateId);
    if (!candidateEntry) return;

    interface CandidateMatchOption {
      otherId: string;
      other: QueueEntry;
      distance: number | null;
      lastMatchedTime: number | null;
    }

    const eligibleMatches: CandidateMatchOption[] = [];

    const candHasCoords =
      typeof candidateEntry.user.lat === "number" &&
      typeof candidateEntry.user.lng === "number" &&
      (candidateEntry.user.lat !== 0 || candidateEntry.user.lng !== 0);

    for (const other of waitingEntries) {
      const otherId = other.user.userId;
      if (otherId === candidateId) continue;

      // 1. Check blocking relationships
      if (this.isBlocked(candidateId, otherId)) {
        continue;
      }

      const otherHasCoords =
        typeof other.user.lat === "number" &&
        typeof other.user.lng === "number" &&
        (other.user.lat !== 0 || other.user.lng !== 0);

      const bothHaveCoords = candHasCoords && otherHasCoords;

      // 2. Proximity calculation (Haversine formula ONLY if both users have valid GPS coordinates)
      let distance: number | null = null;
      if (bothHaveCoords) {
        distance = haversineDistanceMeters(
          candidateEntry.user.lat,
          candidateEntry.user.lng,
          other.user.lat,
          other.user.lng
        );
      }

      const maxAllowedDistance = Math.min(
        candidateEntry.user.maxRadiusMeters || 5000,
        other.user.maxRadiusMeters || 5000
      );

      // Distance check: If both users have GPS coordinates, enforce radius limit
      if (bothHaveCoords && distance !== null && distance > maxAllowedDistance) {
        continue;
      }

      const lastMatchedTime = this.getLastMatchedTime(candidateId, otherId);

      eligibleMatches.push({
        otherId,
        other,
        distance,
        lastMatchedTime,
      });
    }

    if (eligibleMatches.length === 0) return;

    // Rank candidates by Circular Fair Matching:
    // 1. Unseen users (never matched in session: lastMatchedTime === null) come first.
    // 2. If all eligible users were matched, pick the one matched FURTHEST in the past (earliest lastMatchedTime).
    // 3. Tie-breaker: Earlier queue arrival time.
    eligibleMatches.sort((a, b) => {
      if (a.lastMatchedTime === null && b.lastMatchedTime !== null) return -1;
      if (a.lastMatchedTime !== null && b.lastMatchedTime === null) return 1;

      if (a.lastMatchedTime === null && b.lastMatchedTime === null) {
        if (a.distance !== null && b.distance !== null) {
          const distDiff = a.distance - b.distance;
          if (Math.abs(distDiff) > 50) return distDiff;
        }
        return a.other.user.queuedAt - b.other.user.queuedAt;
      }

      const timeDiff = (a.lastMatchedTime || 0) - (b.lastMatchedTime || 0);
      if (timeDiff !== 0) return timeDiff;

      if (a.distance !== null && b.distance !== null) {
        const distDiff = a.distance - b.distance;
        if (Math.abs(distDiff) > 50) return distDiff;
      }

      return a.other.user.queuedAt - b.other.user.queuedAt;
    });

    const best = eligibleMatches[0];

    // MATCH FOUND!
    const matchId = `match_${crypto.randomUUID()}`;

    // Clear attachments on ALL sockets belonging to both matched users to prevent multiple simultaneous pairings
    const candidateSockets = this.ctx.getWebSockets(candidateId);
    for (const ws of candidateSockets) {
      try {
        ws.serializeAttachment(null);
      } catch {}
    }

    const bestSockets = this.ctx.getWebSockets(best.otherId);
    for (const ws of bestSockets) {
      try {
        ws.serializeAttachment(null);
      } catch {}
    }

    // Record interaction timestamp for circular tie-breaker memory
    this.recordMatch(candidateId, best.otherId);

    const finalDistanceMeters =
      best.distance !== null && !isNaN(best.distance)
        ? Math.round(best.distance)
        : null;

    const matchPayloadA = JSON.stringify({
      type: "match_found",
      matchId,
      distanceMeters: finalDistanceMeters,
      partner: {
        userId: best.other.user.userId,
        displayName: best.other.user.displayName,
      },
    });

    const matchPayloadB = JSON.stringify({
      type: "match_found",
      matchId,
      distanceMeters: finalDistanceMeters,
      partner: {
        userId: candidateEntry.user.userId,
        displayName: candidateEntry.user.displayName,
      },
    });

    const notify = () => {
      try {
        candidateEntry.ws.send(matchPayloadA);
      } catch (e) {
        console.error("Failed to notify candidate A:", e);
      }

      try {
        best.other.ws.send(matchPayloadB);
      } catch (e) {
        console.error("Failed to notify candidate B:", e);
      }
    };

    // Defer notification to microtask queue so WebSocket accept finishes cleanly
    queueMicrotask(notify);
  }
}
