import { verifySupabaseToken } from "./auth";
import { getPrisma } from "./lib/db";
import { CampusMatcherDO } from "./durable_objects/CampusMatcherDO";
import { MatchRoomDO } from "./durable_objects/MatchRoomDO";
import type { Env } from "./types";
import { BanType, ReportReason } from "@prisma/client";
import {
  isCoordinateInsideCampus,
  haversineDistanceMeters,
  getCampusCenter,
} from "./lib/geo";

export { CampusMatcherDO, MatchRoomDO };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

const banCache = new Map<string, { isBanned: boolean; ban: any; expiresAt: number }>();

function invalidateBanCache(userId: string) {
  banCache.delete(userId);
}

async function checkUserBanCached(userId: string, env: Env): Promise<{ isBanned: boolean; ban: any }> {
  const now = Date.now();
  const cached = banCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return { isBanned: cached.isBanned, ban: cached.ban };
  }

  try {
    const prisma = getPrisma(env);
    const activeBan = await prisma.userBan.findFirst({
      where: {
        user_id: userId,
        OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
      },
    });

    const isBanned = Boolean(activeBan);
    banCache.set(userId, {
      isBanned,
      ban: activeBan || null,
      expiresAt: now + (isBanned ? 15000 : 60000), // Cache not-banned for 60s, banned for 15s
    });
    return { isBanned, ban: activeBan || null };
  } catch (err) {
    console.error("Error checking user ban:", err);
    return { isBanned: cached ? cached.isBanned : false, ban: cached ? cached.ban : null };
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // --------------------------------------------------------------------------
    // 1. WebSocket Upgrade Routing
    // --------------------------------------------------------------------------
    if (request.headers.get("Upgrade") === "websocket") {
      try {
        const authHeader = request.headers.get("Authorization") || url.searchParams.get("token");
        const authUser = await verifySupabaseToken(authHeader, env);

        if (!authUser) {
          return new Response("Unauthorized", { status: 401 });
        }

        // Fast cached ban check before allowing WebSocket connections
        const banStatus = await checkUserBanCached(authUser.userId, env);
        if (banStatus.isBanned) {
          return new Response("Account is currently suspended", { status: 403 });
        }

        if (url.pathname === "/ws/queue") {
          // Route to singleton CampusMatcherDO
          const matcherId = env.CAMPUS_MATCHER.idFromName("global_campus_matcher");
          const matcher = env.CAMPUS_MATCHER.get(matcherId);
          return matcher.fetch(request);
        }

        if (url.pathname.startsWith("/ws/room/")) {
          const matchId = url.pathname.replace("/ws/room/", "");
          if (!matchId) return new Response("Missing matchId", { status: 400 });

          const roomId = env.MATCH_ROOM.idFromName(matchId);
          const room = env.MATCH_ROOM.get(roomId);
          return room.fetch(request);
        }

        return new Response("Invalid WebSocket endpoint", { status: 404 });
      } catch (err) {
        console.error("Worker WebSocket upgrade error:", err);
        return new Response("WebSocket internal error", { status: 500 });
      }
    }

    // --------------------------------------------------------------------------
    // 2. HTTP Public & Health Routes
    // --------------------------------------------------------------------------
    if (url.pathname === "/api/health") {
      return jsonResponse({ status: "healthy", timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
      try {
        const matcherId = env.CAMPUS_MATCHER.idFromName("global_campus_matcher");
        const matcher = env.CAMPUS_MATCHER.get(matcherId);
        const statsRes = await matcher.fetch(new Request("http://internal/stats"));
        const stats = await statsRes.json();
        return jsonResponse(stats);
      } catch {
        return jsonResponse({ onlineCount: 0, queueCount: 0 });
      }
    }

    if (url.pathname === "/api/presence" && request.method === "POST") {
      try {
        const authHeader = request.headers.get("Authorization");
        const authUser = await verifySupabaseToken(authHeader, env);
        if (authUser) {
          const matcherId = env.CAMPUS_MATCHER.idFromName("global_campus_matcher");
          const matcher = env.CAMPUS_MATCHER.get(matcherId);
          await matcher.fetch(
            new Request("http://internal/heartbeat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: authUser.userId }),
            })
          );
        }
        return jsonResponse({ success: true });
      } catch {
        return jsonResponse({ success: false });
      }
    }

    if (url.pathname === "/api/campuses" && request.method === "GET") {
      return jsonResponse({ campuses: [] });
    }

    // --------------------------------------------------------------------------
    // 3. Authenticated HTTP Routes
    // --------------------------------------------------------------------------
    const authHeader = request.headers.get("Authorization");
    const authUser = await verifySupabaseToken(authHeader, env);

    if (!authUser) {
      return errorResponse("Unauthorized", 401);
    }

    const prisma = getPrisma(env);

    // Ban Check Middleware (Cached)
    const banStatus = await checkUserBanCached(authUser.userId, env);

    if (url.pathname === "/api/bans/check" && request.method === "GET") {
      return jsonResponse({
        isBanned: banStatus.isBanned,
        ban: banStatus.ban,
      });
    }

    if (banStatus.isBanned) {
      return errorResponse("Your account is currently banned.", 403);
    }

    // User Profile
    if (url.pathname === "/api/profile") {
      if (request.method === "GET") {
        let profile = await prisma.userProfile.findUnique({
          where: { user_id: authUser.userId },
        });

        if (!profile) {
          // Generate default pseudonymous display name
          const animals = ["Fox", "Owl", "Panda", "Wolf", "Hawk", "Otter", "Lynx", "Falcon"];
          const colors = ["Blue", "Silver", "Crimson", "Golden", "Jade", "Cosmic", "Shadow"];
          const randomName = `${colors[Math.floor(Math.random() * colors.length)]}${
            animals[Math.floor(Math.random() * animals.length)]
          }${Math.floor(100 + Math.random() * 900)}`;

          profile = await prisma.userProfile.create({
            data: {
              user_id: authUser.userId,
              display_name: randomName,
            },
          });
        }

        return jsonResponse({ profile });
      }

      if (request.method === "POST") {
        const body: { displayName?: string } = await request.json();
        const displayName = (body.displayName || "").trim();

        if (!displayName || displayName.length < 2 || displayName.length > 30) {
          return errorResponse("Display name must be between 2 and 30 characters.");
        }

        const profile = await prisma.userProfile.upsert({
          where: { user_id: authUser.userId },
          update: { display_name: displayName },
          create: {
            user_id: authUser.userId,
            display_name: displayName,
          },
        });

        return jsonResponse({ profile });
      }
    }

    // Campus Preferences
    if (url.pathname === "/api/preferences") {
      if (request.method === "GET") {
        const prefs = await prisma.userCampusPreference.findMany({
          where: { user_id: authUser.userId },
          select: { campus_id: true },
        });
        return jsonResponse({ preferences: prefs.map((p) => p.campus_id) });
      }

      if (request.method === "POST") {
        const body: { campusIds: string[] } = await request.json();
        const campusIds = Array.isArray(body.campusIds) ? body.campusIds : [];

        // Replace preferences transactionally
        await prisma.$transaction([
          prisma.userCampusPreference.deleteMany({
            where: { user_id: authUser.userId },
          }),
          prisma.userCampusPreference.createMany({
            data: campusIds.map((cid) => ({
              user_id: authUser.userId,
              campus_id: cid,
            })),
            skipDuplicates: true,
          }),
        ]);

        return jsonResponse({ success: true, campusIds });
      }
    }

    // User Blocks
    if (url.pathname === "/api/blocks") {
      if (request.method === "GET") {
        const blocks = await prisma.userBlock.findMany({
          where: { blocker_user_id: authUser.userId },
          include: {
            blocked: {
              select: { user_id: true, display_name: true },
            },
          },
        });
        return jsonResponse({ blocks });
      }

      if (request.method === "POST") {
        const body: { targetUserId: string } = await request.json();
        if (!body.targetUserId || body.targetUserId === authUser.userId) {
          return errorResponse("Invalid target user ID.");
        }

        await prisma.userBlock.upsert({
          where: {
            blocker_user_id_blocked_user_id: {
              blocker_user_id: authUser.userId,
              blocked_user_id: body.targetUserId,
            },
          },
          update: {},
          create: {
            blocker_user_id: authUser.userId,
            blocked_user_id: body.targetUserId,
          },
        });

        return jsonResponse({ success: true });
      }
    }

    if (url.pathname.startsWith("/api/blocks/") && request.method === "DELETE") {
      const blockedUserId = url.pathname.replace("/api/blocks/", "");
      await prisma.userBlock.deleteMany({
        where: {
          blocker_user_id: authUser.userId,
          blocked_user_id: blockedUserId,
        },
      });
      return jsonResponse({ success: true });
    }

    // --------------------------------------------------------------------------
    // 4. Context-Bound Reporting with Automated Bans
    // --------------------------------------------------------------------------
    if (url.pathname === "/api/reports" && request.method === "POST") {
      const body: {
        reportedUserId: string;
        matchId: string;
        reason: ReportReason;
        details?: string;
      } = await request.json();

      const { reportedUserId, matchId, reason, details } = body;

      if (!reportedUserId || !matchId || !reason) {
        return errorResponse("Missing required report fields.");
      }

      if (reportedUserId === authUser.userId) {
        return errorResponse("You cannot report yourself.");
      }

      if (details && details.length > 300) {
        return errorResponse("Report details must be under 300 characters.");
      }

      // Verify match context via MatchRoomDO
      const roomId = env.MATCH_ROOM.idFromName(matchId);
      const room = env.MATCH_ROOM.get(roomId);
      const verifyRes = await room.fetch(
        new Request("https://internal/verify_match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reporterId: authUser.userId,
            reportedId: reportedUserId,
          }),
        })
      );

      if (!verifyRes.ok) {
        const err = (await verifyRes.json()) as { reason?: string };
        return errorResponse(
          `Invalid report: ${err?.reason || "Reporting context verification failed."}`,
          400
        );
      }

      // Check distinct reporter constraint
      const existingReport = await prisma.report.findUnique({
        where: {
          reporter_user_id_reported_user_id: {
            reporter_user_id: authUser.userId,
            reported_user_id: reportedUserId,
          },
        },
      });

      if (existingReport) {
        return errorResponse("You have already reported this user.", 409);
      }

      // Persist the report
      await prisma.report.create({
        data: {
          reporter_user_id: authUser.userId,
          reported_user_id: reportedUserId,
          match_id: matchId,
          reason,
          details: details ? details.trim() : null,
        },
      });

      // Calculate total lifetime distinct reporters for this target
      const distinctCount = await prisma.report.count({
        where: { reported_user_id: reportedUserId },
      });

      const t24h = parseInt(env.REPORT_THRESHOLD_24H || "6", 10);
      const t7d = parseInt(env.REPORT_THRESHOLD_7D || "11", 10);
      const tPerm = parseInt(env.REPORT_THRESHOLD_PERMANENT || "20", 10);

      // Automated Ban Enforcement
      if (distinctCount >= tPerm) {
        await prisma.userBan.upsert({
          where: { user_id: reportedUserId },
          update: {
            ban_type: BanType.PERMANENT,
            expires_at: null,
            reason: `Exceeded permanent ban threshold (${distinctCount} distinct reports).`,
          },
          create: {
            user_id: reportedUserId,
            ban_type: BanType.PERMANENT,
            expires_at: null,
            reason: `Exceeded permanent ban threshold (${distinctCount} distinct reports).`,
          },
        });
      } else if (distinctCount >= t7d) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await prisma.userBan.upsert({
          where: { user_id: reportedUserId },
          update: {
            ban_type: BanType.TEMPORARY_7D,
            expires_at: expiresAt,
            reason: `Exceeded 7-day ban threshold (${distinctCount} distinct reports).`,
          },
          create: {
            user_id: reportedUserId,
            ban_type: BanType.TEMPORARY_7D,
            expires_at: expiresAt,
            reason: `Exceeded 7-day ban threshold (${distinctCount} distinct reports).`,
          },
        });
      } else if (distinctCount >= t24h) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.userBan.upsert({
          where: { user_id: reportedUserId },
          update: {
            ban_type: BanType.TEMPORARY_24H,
            expires_at: expiresAt,
            reason: `Exceeded 24-hour ban threshold (${distinctCount} distinct reports).`,
          },
          create: {
            user_id: reportedUserId,
            ban_type: BanType.TEMPORARY_24H,
            expires_at: expiresAt,
            reason: `Exceeded 24-hour ban threshold (${distinctCount} distinct reports).`,
          },
        });
      }

      if (distinctCount >= t24h) {
        invalidateBanCache(reportedUserId);
      }

      return jsonResponse({
        success: true,
        message: "Report submitted successfully.",
      });
    }

    return errorResponse("Endpoint not found", 404);
  },
};
