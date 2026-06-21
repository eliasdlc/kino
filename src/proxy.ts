import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// NOTE: This rate limiter is in-memory and only effective within a single
// Vercel Serverless instance. Parallel cold-starts each have their own map,
// so it provides best-effort protection in development but NOT in production
// at scale. A shared store (e.g. Vercel KV) is required for production-grade
// rate limiting. Accepted trade-off given the $0/month constraint.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now - value.lastReset > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}

let requestCounter = 0;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rate limiting para endpoints de autenticación
  if (pathname.startsWith("/api/auth/")) {
    requestCounter++;
    if (requestCounter % 100 === 0) cleanupRateLimitMap();

    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (record && now - record.lastReset < RATE_LIMIT_WINDOW_MS) {
      record.count += 1;
      if (record.count > MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json(
          { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    } else {
      rateLimitMap.set(ip, { count: 1, lastReset: now });
    }
    return NextResponse.next();
  }

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/docs") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/cron/") ||
    // The remote MCP connector authenticates itself via OAuth 2.1 inside the
    // route (withMcpAuth), so it must bypass the session-cookie gate here.
    pathname.startsWith("/api/mcp");

  if (!isPublicRoute) {
    const sessionCookie = getSessionCookie(request);
    // Any Bearer token (personal API key `sk-kino-` or an OAuth 2.1 access token
    // from the web MCP connector) is validated downstream by getAuthContext.
    // The middleware only gates fully-unauthenticated browser traffic.
    const hasBearer = request.headers
      .get("authorization")
      ?.startsWith("Bearer ");

    if (!sessionCookie && !hasBearer) {
      // Las llamadas AJAX a /api/* deben recibir 401, no un redirect HTML
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { code: "UNAUTHORIZED", message: "Unauthorized" },
          { status: 401 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
