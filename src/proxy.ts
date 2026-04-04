import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth/")) {
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (record && now - record.lastReset < RATE_LIMIT_WINDOW_MS) {
      record.count += 1;
      if (record.count > MAX_REQUESTS_PER_WINDOW) {
        return NextResponse.json(
          { code: "RATE_LIMITED", message: "Too many requests." },
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
    pathname.startsWith("/api/auth") ||
    pathname.includes(".");

  if (!isPublicRoute) {
    try {
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (!session) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }
    } catch {
      // Si la DB falla, redirigir a login — nunca exponer el error al cliente
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
