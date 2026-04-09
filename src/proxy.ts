import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

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
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth");

  if (!isPublicRoute) {
    const sessionCookie = getSessionCookie(request);

    if (!sessionCookie) {
      // Las llamadas AJAX a /api/* deben recibir 401, no un redirect HTML
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { code: "UNAUTHORIZED", message: "Unauthorized" },
          { status: 401 }
        );
      }

      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
