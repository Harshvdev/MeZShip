import { DurableObject } from "cloudflare:workers";
import type { Env, WaitingUser } from "../types";
import { isCoordinateInsideCampus, haversineDistanceMeters } from "../lib/geo";
import { getPrisma } from "../lib/db";

interface QueueEntry {
  ws: WebSocket;
  user: WaitingUser;
}

export class CampusMatcherDO extends DurableObject<Env> {
  private queue: Map<string, QueueEntry> = new Map();
  private presence: Map<string, number> = new Map(); // userId -> lastSeen timestamp
  private campusBoundaries: Map<string, any> = new Map();
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

  private async ensureBoundaries() {
    if (this.campusBoundaries.size > 0) return;
    try {
      const prisma = getPrisma(this.env);
      const campuses = await prisma.campus.findMany({
        where: { active: true },
        select: { id: true, boundary: true },
      });
      for (const c of campuses) {
        this.campusBoundaries.set(c.id, c.boundary);
      }
    } catch (e) {
      console.error("Failed to preload boundaries in DO:", e);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle WebSocket upgrade for matchmaking queue
    if (request.headers.get("Upgrade") === "websocket") {
      await this.ensureBoundaries();
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = url.searchParams.get("userId") || "";
      const displayName = url.searchParams.get("displayName") || "Anonymous";
      const lat = parseFloat(url.searchParams.get("lat") || "0");
      const lng = parseFloat(url.searchParams.get("lng") || "0");
      const campusIds = (url.searchParams.get("campuses") || "").split(",").filter(Boolean);
      const maxRadiusMeters = parseFloat(url.searchParams.get("radius") || "2000");

      if (!userId) {
        return new Response("Missing userId", { status: 400 });
      }

      this.ctx.acceptWebSocket(server, [userId]);

      const waitingUser: WaitingUser = {
        userId,
        displayName,
        lat,
        lng,
        campusIds,
        maxRadiusMeters,
        queuedAt: Date.now(),
      };

      this.queue.set(userId, { ws: server, user: waitingUser });
      this.presence.set(userId, Date.now());
      this.cleanPresence();

      const totalOnline = Math.max(1, this.presence.size, this.queue.size);

      server.send(
        JSON.stringify({
          type: "queue_joined",
          message: "Searching for a compatible nearby match...",
          queuedAt: waitingUser.queuedAt,
          queueCount: this.queue.size,
          onlineCount: totalOnline,
        })
      );

      // Attempt matching immediately
      this.tryMatch(userId);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/stats" || url.pathname.endsWith("/stats")) {
      this.cleanPresence();
      const totalOnline = Math.max(1, this.presence.size, this.queue.size);
      return new Response(
        JSON.stringify({
          onlineCount: totalOnline,
          queueCount: this.queue.size,
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
      return new Response(
        JSON.stringify({
          onlineCount: Math.max(1, this.presence.size, this.queue.size),
          queueCount: this.queue.size,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname === "/update_campuses" && request.method === "POST") {
      const campuses: Array<{ id: string; boundary: any }> = await request.json();
      for (const c of campuses) {
        this.campusBoundaries.set(c.id, c.boundary);
      }
      return new Response(JSON.stringify({ success: true }));
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
      if (data.type === "leave_queue") {
        const userId = data.userId;
        if (userId) {
          this.queue.delete(userId);
          ws.send(JSON.stringify({ type: "queue_left" }));
        }
      } else if (data.type === "update_location") {
        const entry = this.queue.get(data.userId);
        if (entry) {
          entry.user.lat = data.lat;
          entry.user.lng = data.lng;
          this.tryMatch(data.userId);
        }
      }
    } catch (e) {
      console.error("Queue WS Message error:", e);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    for (const [userId, entry] of this.queue.entries()) {
      if (entry.ws === ws) {
        this.queue.delete(userId);
        break;
      }
    }
  }

  private isBlocked(userA: string, userB: string): boolean {
    return (
      this.blockPairs.has(`${userA}:${userB}`) ||
      this.blockPairs.has(`${userB}:${userA}`)
    );
  }

  private checkGeofence(user: WaitingUser, campusId: string): boolean {
    const boundary = this.campusBoundaries.get(campusId);
    if (!boundary) {
      return true;
    }
    return isCoordinateInsideCampus(user.lng, user.lat, boundary);
  }

  private tryMatch(candidateId: string) {
    const candidate = this.queue.get(candidateId);
    if (!candidate) return;

    interface CandidateMatchOption {
      otherId: string;
      other: QueueEntry;
      validCampusId: string;
      distance: number;
      lastMatchedTime: number | null;
    }

    const eligibleMatches: CandidateMatchOption[] = [];

    for (const [otherId, other] of this.queue.entries()) {
      if (otherId === candidateId) continue;

      // 1. Check blocking relationships
      if (this.isBlocked(candidateId, otherId)) {
        continue;
      }

      // 2. Find mutual eligible campuses
      const sharedCampuses = candidate.user.campusIds.filter((cid) =>
        other.user.campusIds.includes(cid)
      );
      if (sharedCampuses.length === 0) {
        continue;
      }

      const validCampusId = sharedCampuses[0];

      // 3. Proximity calculation (Haversine formula)
      const distance = haversineDistanceMeters(
        candidate.user.lat,
        candidate.user.lng,
        other.user.lat,
        other.user.lng
      );

      const maxAllowedDistance = Math.min(
        candidate.user.maxRadiusMeters,
        other.user.maxRadiusMeters
      );

      if (distance > maxAllowedDistance) {
        continue;
      }

      const lastMatchedTime = this.getLastMatchedTime(candidateId, otherId);

      eligibleMatches.push({
        otherId,
        other,
        validCampusId,
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
        return a.other.user.queuedAt - b.other.user.queuedAt;
      }

      const timeDiff = (a.lastMatchedTime || 0) - (b.lastMatchedTime || 0);
      if (timeDiff !== 0) return timeDiff;

      return a.other.user.queuedAt - b.other.user.queuedAt;
    });

    const best = eligibleMatches[0];

    // MATCH FOUND!
    const matchId = `match_${crypto.randomUUID()}`;

    // Remove both from queue
    this.queue.delete(candidateId);
    this.queue.delete(best.otherId);

    // Record interaction timestamp for circular tie-breaker memory
    this.recordMatch(candidateId, best.otherId);

    const matchPayloadA = {
      type: "match_found",
      matchId,
      campusId: best.validCampusId,
      distanceMeters: Math.round(best.distance),
      partner: {
        userId: best.other.user.userId,
        displayName: best.other.user.displayName,
      },
    };

    const matchPayloadB = {
      type: "match_found",
      matchId,
      campusId: best.validCampusId,
      distanceMeters: Math.round(best.distance),
      partner: {
        userId: candidate.user.userId,
        displayName: candidate.user.displayName,
      },
    };

    try {
      candidate.ws.send(JSON.stringify(matchPayloadA));
    } catch (e) {
      console.error("Failed to notify candidate A:", e);
    }

    try {
      best.other.ws.send(JSON.stringify(matchPayloadB));
    } catch (e) {
      console.error("Failed to notify candidate B:", e);
    }
  }
}
