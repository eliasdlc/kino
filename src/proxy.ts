import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
let requestCounter = 0;

function cleanupRateLimitMap() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now - value.lastReset > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}

export function proxy(request: NextRequest) {
  requestCounter++;
  if (requestCounter % 100 === 0) cleanupRateLimitMap();

  const { pathname } = request.nextUrl;

  // Rate limiting for auth endpoints
  if (pathname.startsWith("/api/auth/")) {
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now - record.lastReset > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.set(ip, { count: 1, lastReset: now });
    } else {
      record.count += 1;
      if (record.count > MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json(
          { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }
    }
    return NextResponse.next();
  }

  // Session check for all other API routes
  if (!pathname.startsWith("/api/") && !pathname.startsWith("/login") && !pathname.startsWith("/register")) {
    const session = getSessionCookie(request);
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|login|register|_next/static|_next/image|favicon.ico).*)"],
};
