import { DurableObject } from "cloudflare:workers";
import type { Env, WaitingUser } from "../types";
import { isCoordinateInsideCampus, haversineDistanceMeters } from "../lib/geo";
import { getPrisma } from "../lib/db";

interface QueueEntry {
  ws: WebSocket;
  user: WaitingUser;
}

export class CampusMatcherDO extends DurableObject<Env> {
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
      await this.ensureBoundaries();
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = url.searchParams.get("userId") || "";
      const displayName = url.searchParams.get("displayName") || "Anonymous";
      const lat = parseFloat(url.searchParams.get("lat") || "0");
      const lng = parseFloat(url.searchParams.get("lng") || "0");
      const campusIds = (url.searchParams.get("campuses") || "").split(",").filter(Boolean);
      const maxRadiusMeters = parseFloat(url.searchParams.get("radius") || "5000");

      if (!userId) {
        return new Response("Missing userId", { status: 400 });
      }

      const waitingUser: WaitingUser = {
        userId,
        displayName,
        lat,
        lng,
        campusIds,
        maxRadiusMeters,
        queuedAt: Date.now(),
      };

      // Hibernation-safe attachment and acceptance
      server.serializeAttachment(waitingUser);
      this.ctx.acceptWebSocket(server, [userId]);

      this.presence.set(userId, Date.now());
      this.cleanPresence();

      const waitingEntries = this.getWaitingEntries();
      const totalOnline = Math.max(1, this.presence.size, waitingEntries.length);

      server.send(
        JSON.stringify({
          type: "queue_joined",
          message: "Searching for a compatible nearby match...",
          queuedAt: waitingUser.queuedAt,
          queueCount: waitingEntries.length,
          onlineCount: totalOnline,
        })
      );

      // Attempt matching immediately
      this.tryMatch(userId);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/stats" || url.pathname.endsWith("/stats")) {
      this.cleanPresence();
      const queueCount = this.getWaitingEntries().length;
      const totalOnline = Math.max(1, this.presence.size, queueCount);
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
          onlineCount: Math.max(1, this.presence.size, queueCount),
          queueCount,
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
          current.lat = data.lat;
          current.lng = data.lng;
          ws.serializeAttachment(current);
          await this.ensureBoundaries();
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

  private checkGeofence(user: WaitingUser, campusId: string): boolean {
    const boundary = this.campusBoundaries.get(campusId);
    if (!boundary) {
      return true;
    }
    return isCoordinateInsideCampus(user.lng, user.lat, boundary);
  }

  private tryMatch(candidateId: string) {
    const waitingEntries = this.getWaitingEntries();
    const candidateEntry = waitingEntries.find((e) => e.user.userId === candidateId);
    if (!candidateEntry) return;

    interface CandidateMatchOption {
      otherId: string;
      other: QueueEntry;
      validCampusId: string;
      distance: number;
      lastMatchedTime: number | null;
    }

    const eligibleMatches: CandidateMatchOption[] = [];

    for (const other of waitingEntries) {
      const otherId = other.user.userId;
      if (otherId === candidateId) continue;

      // 1. Check blocking relationships
      if (this.isBlocked(candidateId, otherId)) {
        continue;
      }

      // 2. Check mutual campus or open proximity preferences
      const candidateHasCampusFilter =
        candidateEntry.user.campusIds.length > 0 &&
        !candidateEntry.user.campusIds.includes("all") &&
        !candidateEntry.user.campusIds.includes("*");
      const otherHasCampusFilter =
        other.user.campusIds.length > 0 &&
        !other.user.campusIds.includes("all") &&
        !other.user.campusIds.includes("*");

      const sharedCampuses = candidateEntry.user.campusIds.filter((cid) =>
        other.user.campusIds.includes(cid)
      );

      // If both users explicitly picked specific campuses and share none, skip
      if (candidateHasCampusFilter && otherHasCampusFilter && sharedCampuses.length === 0) {
        continue;
      }

      const validCampusId = sharedCampuses.length > 0 ? sharedCampuses[0] : "nearby";

      // 3. Proximity calculation (Haversine formula)
      const distance = haversineDistanceMeters(
        candidateEntry.user.lat,
        candidateEntry.user.lng,
        other.user.lat,
        other.user.lng
      );

      const maxAllowedDistance = Math.min(
        candidateEntry.user.maxRadiusMeters || 5000,
        other.user.maxRadiusMeters || 5000
      );

      // Distance check: must be within max allowed distance (default 5 km)
      // If either user doesn't have GPS coordinates (lat/lng = 0), allow connecting
      const hasCoords =
        (candidateEntry.user.lat !== 0 || candidateEntry.user.lng !== 0) &&
        (other.user.lat !== 0 || other.user.lng !== 0);

      if (hasCoords && distance > maxAllowedDistance) {
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

    // Clear attachments immediately so neither candidate is matched again concurrently
    try {
      candidateEntry.ws.serializeAttachment(null);
    } catch {}
    try {
      best.other.ws.serializeAttachment(null);
    } catch {}

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
        userId: candidateEntry.user.userId,
        displayName: candidateEntry.user.displayName,
      },
    };

    try {
      candidateEntry.ws.send(JSON.stringify(matchPayloadA));
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
