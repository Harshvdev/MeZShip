import { DurableObject } from "cloudflare:workers";
import type { Env, WaitingUser } from "../types";
import { haversineDistanceMeters } from "../lib/geo";

interface QueueEntry {
  ws: WebSocket;
  user: WaitingUser;
}

export class CampusMatcherDO extends DurableObject<Env> {
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
   * Retrieves active waiting users from WebSockets across DO hibernations
   */
  private getWaitingEntries(): QueueEntry[] {
    const sockets = this.ctx.getWebSockets();
    const entries: QueueEntry[] = [];
    for (const ws of sockets) {
      try {
        const user = ws.deserializeAttachment() as WaitingUser | null;
        if (user && user.userId) {
          entries.push({ ws, user });
        }
      } catch {}
    }
    return entries;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade for matchmaking queue
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = url.searchParams.get("userId") || "";
      const displayName = url.searchParams.get("displayName") || "Anonymous";
      const parsedLat = parseFloat(url.searchParams.get("lat") || "0");
      const parsedLng = parseFloat(url.searchParams.get("lng") || "0");
      const lat = Number.isFinite(parsedLat) ? parsedLat : 0;
      const lng = Number.isFinite(parsedLng) ? parsedLng : 0;
      const parsedRadius = parseFloat(url.searchParams.get("radius") || "5000");
      const maxRadiusMeters = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : 5000;

      if (!userId) {
        return new Response("Missing userId", { status: 400 });
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

    return new Response("CampusMatcherDO Active", { status: 200 });
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
          const lat = typeof data.lat === "number" ? data.lat : parseFloat(data.lat);
          const lng = typeof data.lng === "number" ? data.lng : parseFloat(data.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            current.lat = lat;
            current.lng = lng;
          }
          if (data.radius) {
            const radius = typeof data.radius === "number" ? data.radius : parseFloat(data.radius);
            if (Number.isFinite(radius) && radius > 0) {
              current.maxRadiusMeters = radius;
            }
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
      distance: number;
      hasPreciseDistance: boolean;
      lastMatchedTime: number | null;
    }

    const eligibleMatches: CandidateMatchOption[] = [];

    const candLat = candidateEntry.user.lat;
    const candLng = candidateEntry.user.lng;
    const candHasCoords =
      typeof candLat === "number" &&
      typeof candLng === "number" &&
      Number.isFinite(candLat) &&
      Number.isFinite(candLng) &&
      (candLat !== 0 || candLng !== 0);

    for (const other of waitingEntries) {
      const otherId = other.user.userId;
      if (otherId === candidateId) continue;

      // 1. Check blocking relationships
      if (this.isBlocked(candidateId, otherId)) {
        continue;
      }

      const otherLat = other.user.lat;
      const otherLng = other.user.lng;
      const otherHasCoords =
        typeof otherLat === "number" &&
        typeof otherLng === "number" &&
        Number.isFinite(otherLat) &&
        Number.isFinite(otherLng) &&
        (otherLat !== 0 || otherLng !== 0);

      const bothHaveCoords = candHasCoords && otherHasCoords;

      let distance = 0;
      let hasPreciseDistance = false;

      if (bothHaveCoords) {
        // 2. Proximity calculation (Haversine formula)
        distance = haversineDistanceMeters(candLat, candLng, otherLat, otherLng);
        hasPreciseDistance = true;

        const maxAllowedDistance = Math.min(
          candidateEntry.user.maxRadiusMeters || 5000,
          other.user.maxRadiusMeters || 5000
        );

        // Distance check: must be within max allowed distance (default 5 km)
        if (distance > maxAllowedDistance) {
          continue;
        }
      } else {
        // Fallback: When coordinates are missing, permit match without calculating distance against (0,0) Null Island
        distance = 0;
        hasPreciseDistance = false;
      }

      const lastMatchedTime = this.getLastMatchedTime(candidateId, otherId);

      eligibleMatches.push({
        otherId,
        other,
        distance,
        hasPreciseDistance,
        lastMatchedTime,
      });
    }

    if (eligibleMatches.length === 0) return;

    // Rank candidates by Circular Fair Matching:
    // 1. Unseen users (never matched in session: lastMatchedTime === null) come first.
    // 2. If all eligible users were matched, pick the one matched FURTHEST in the past (earliest lastMatchedTime).
    // 3. Tie-breaker: Closer peers when distance is known, then earlier queue arrival time.
    eligibleMatches.sort((a, b) => {
      if (a.lastMatchedTime === null && b.lastMatchedTime !== null) return -1;
      if (a.lastMatchedTime !== null && b.lastMatchedTime === null) return 1;

      if (a.lastMatchedTime === null && b.lastMatchedTime === null) {
        if (a.hasPreciseDistance && b.hasPreciseDistance) {
          const distDiff = a.distance - b.distance;
          if (Math.abs(distDiff) > 50) return distDiff;
        }
        return a.other.user.queuedAt - b.other.user.queuedAt;
      }

      const timeDiff = (a.lastMatchedTime || 0) - (b.lastMatchedTime || 0);
      if (timeDiff !== 0) return timeDiff;

      return a.other.user.queuedAt - b.other.user.queuedAt;
    });

    const best = eligibleMatches[0];

    // MATCH FOUND!
    const matchId = `match_${crypto.randomUUID()}`;

    // Clear attachments immediately so neither candidate is matched again concurrently
    try {
      candidateEntry.ws.serializeAttachment(null);
    } catch {}
    try {
      best.other.ws.serializeAttachment(null);
    } catch {}

    // Record interaction timestamp for circular tie-breaker memory
    this.recordMatch(candidateId, best.otherId);

    const calculatedDistance = Math.round(best.distance);

    const matchPayloadA = JSON.stringify({
      type: "match_found",
      matchId,
      distanceMeters: calculatedDistance,
      hasPreciseDistance: best.hasPreciseDistance,
      partner: {
        userId: best.other.user.userId,
        displayName: best.other.user.displayName,
      },
    });

    const matchPayloadB = JSON.stringify({
      type: "match_found",
      matchId,
      distanceMeters: calculatedDistance,
      hasPreciseDistance: best.hasPreciseDistance,
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
