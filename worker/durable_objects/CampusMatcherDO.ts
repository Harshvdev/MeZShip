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
  private campusBoundaries: Map<string, any> = new Map();
  private blockPairs: Set<string> = new Set(); // "blocker:blocked"

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
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

      server.send(
        JSON.stringify({
          type: "queue_joined",
          message: "Searching for a compatible nearby match...",
          queuedAt: waitingUser.queuedAt,
        })
      );

      // Attempt matching immediately
      this.tryMatch(userId);

      return new Response(null, { status: 101, webSocket: client });
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
      // If boundary not yet cached, allow candidate to proceed in dev
      return true;
    }
    return isCoordinateInsideCampus(user.lng, user.lat, boundary);
  }

  private tryMatch(candidateId: string) {
    const candidate = this.queue.get(candidateId);
    if (!candidate) return;

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

      // 3. Verify campus geofence for both users
      let validCampusId: string | null = null;
      for (const cid of sharedCampuses) {
        const c1 = this.checkGeofence(candidate.user, cid);
        const c2 = this.checkGeofence(other.user, cid);
        if (c1 && c2) {
          validCampusId = cid;
          break;
        }
      }

      if (!validCampusId) {
        continue;
      }

      // 4. Proximity calculation (Haversine formula)
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

      // MATCH FOUND!
      const matchId = `match_${crypto.randomUUID()}`;

      // Remove both from queue
      this.queue.delete(candidateId);
      this.queue.delete(otherId);

      const matchPayloadA = {
        type: "match_found",
        matchId,
        campusId: validCampusId,
        distanceMeters: Math.round(distance),
        partner: {
          userId: other.user.userId,
          displayName: other.user.displayName,
        },
      };

      const matchPayloadB = {
        type: "match_found",
        matchId,
        campusId: validCampusId,
        distanceMeters: Math.round(distance),
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
        other.ws.send(JSON.stringify(matchPayloadB));
      } catch (e) {
        console.error("Failed to notify candidate B:", e);
      }

      return;
    }
  }
}
