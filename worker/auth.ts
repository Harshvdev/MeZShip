import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader, decodeJwt } from "jose";
import type { Env, AuthenticatedUser } from "./types";

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let lastJwksUrl = "";

const tokenVerificationCache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();

function getJWKS(jwksUrl: string) {
  if (!jwksCache || lastJwksUrl !== jwksUrl) {
    jwksCache = createRemoteJWKSet(new URL(jwksUrl), {
      cacheMaxAge: 3600000, // 1 hour
      cooldownDuration: 30000, // 30 seconds
    });
    lastJwksUrl = jwksUrl;
  }
  return jwksCache;
}

export async function verifySupabaseToken(
  authHeader: string | null,
  env: Env
): Promise<AuthenticatedUser | null> {
  if (!authHeader) {
    return null;
  }

  let token = authHeader.trim();
  if (token.startsWith("Bearer ")) {
    token = token.slice(7).trim();
  }
  if (!token) return null;

  const now = Date.now();
  const cached = tokenVerificationCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }

  try {
    let header: { alg?: string; typ?: string } = {};
    try {
      header = decodeProtectedHeader(token);
    } catch {
      // Fallback: manually inspect header if malformed or non-standard
      const parts = token.split(".");
      if (parts.length >= 2) {
        header = JSON.parse(atob(parts[0]));
      }
    }

    const alg = header.alg || "HS256";
    let verifiedUser: AuthenticatedUser | null = null;

    // 1. Asymmetric verification (RS256 / ES256 via JWKS)
    if (alg === "RS256" || alg === "ES256") {
      let jwksUrl =
        env.SUPABASE_JWKS_URL ||
        (env.SUPABASE_URL
          ? `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`
          : env.NEXT_PUBLIC_SUPABASE_URL
          ? `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`
          : null);

      if (!jwksUrl) {
        try {
          const decoded = decodeJwt(token);
          if (decoded && typeof decoded.iss === "string" && decoded.iss.startsWith("https://")) {
            const iss = decoded.iss.replace(/\/+$/, "");
            jwksUrl = iss.endsWith("/auth/v1")
              ? `${iss}/.well-known/jwks.json`
              : `${iss}/auth/v1/.well-known/jwks.json`;
          }
        } catch {}
      }

      if (jwksUrl) {
        try {
          const JWKS = getJWKS(jwksUrl);
          const verifyPromise = jwtVerify(token, JWKS, {
            algorithms: ["ES256", "RS256"],
          });
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("JWKS verify timeout")), 1200)
          );
          const result = (await Promise.race([verifyPromise, timeoutPromise])) as any;
          if (result && result.payload && result.payload.sub) {
            verifiedUser = {
              userId: result.payload.sub,
              email: typeof result.payload.email === "string" ? result.payload.email : undefined,
            };
          }
        } catch (jwksErr) {
          // In development, do not fail on JWKS network timeout
          if (env.NODE_ENV !== "development") {
            console.warn("JWKS verification error:", jwksErr);
          }
        }
      }
    }

    // 2. Symmetric verification (HS256 via SUPABASE_JWT_SECRET if present)
    if (!verifiedUser && alg === "HS256" && env.SUPABASE_JWT_SECRET) {
      try {
        const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
        const { payload } = await jwtVerify(token, secret, {
          algorithms: ["HS256"],
        });
        if (payload.sub) {
          verifiedUser = {
            userId: payload.sub,
            email: typeof payload.email === "string" ? payload.email : undefined,
          };
        }
      } catch (hsErr) {
        console.warn("HS256 secret verification failed:", hsErr);
      }
    }

    // 3. Claims & Expiration validation (Dev-only fallback if signature could not be verified)
    if (!verifiedUser && env.NODE_ENV === "development") {
      const payload = decodeJwt(token);
      if (payload && payload.sub) {
        const nowSeconds = Math.floor(Date.now() / 1000);
        // Allow clock skew in dev
        if (!payload.nbf || nowSeconds >= payload.nbf - 60) {
          verifiedUser = {
            userId: payload.sub,
            email: typeof payload.email === "string" ? payload.email : undefined,
          };
        }
      }
    }

    if (verifiedUser) {
      // Cache verified token in memory for fast repeat lookups (up to 60s)
      tokenVerificationCache.set(token, {
        user: verifiedUser,
        expiresAt: now + 60000,
      });
      return verifiedUser;
    }

    // In production, unverified tokens must strictly be rejected
    console.warn("JWT verification failed: cryptographic signature could not be verified against JWKS or secret.");
    return null;
  } catch (err) {
    console.error("Token verification failed:", err);
    return null;
  }
}

