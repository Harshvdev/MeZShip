import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env, AuthenticatedUser } from "./types";

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let lastJwksUrl = "";

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

  const jwksUrl =
    env.SUPABASE_JWKS_URL ||
    (env.SUPABASE_URL
      ? `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`
      : env.NEXT_PUBLIC_SUPABASE_URL
      ? `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`
      : null);

  if (!jwksUrl) {
    // In local dev without configured remote JWKS, attempt decode if dummy token or warn
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.sub) {
          return {
            userId: payload.sub,
            email: payload.email,
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    const JWKS = getJWKS(jwksUrl);
    const { payload } = await jwtVerify(token, JWKS, {
      algorithms: ["ES256", "RS256"],
    });

    if (!payload.sub) {
      return null;
    }

    return {
      userId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch (err) {
    console.error("JWT verification failed:", err);
    return null;
  }
}
