import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// In-memory rate limiting store for Vercel Edge ($0/month, per isolate)
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5; // Max requests per IP per minute for auth endpoints

// Basic clean-up function to prevent memory leaks in the Map
function cleanupRateLimitMap() {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
        if (now - value.lastReset > RATE_LIMIT_WINDOW_MS) {
            rateLimitMap.delete(key);
        }
    }
}

let requestCounter = 0;

export async function middleware(request: NextRequest) {
    requestCounter++;
    // Cleanup every 100 requests to avoid unbounded Map growth
    if (requestCounter % 100 === 0) cleanupRateLimitMap();

    const { pathname } = request.nextUrl;

    // 1. Rate Limiting for /api/auth/*
    const isAuthRoute = pathname.startsWith('/api/auth/');
    if (isAuthRoute) {
        const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
        const now = Date.now();

        const record = rateLimitMap.get(ip);

        if (!record || now - record.lastReset > RATE_LIMIT_WINDOW_MS) {
            rateLimitMap.set(ip, { count: 1, lastReset: now });
        } else {
            record.count += 1;
            if (record.count > MAX_REQUESTS_PER_WINDOW) {
                return NextResponse.json(
                    { code: "RATE_LIMITED", message: "Too many requests to auth endpoints. Please try again later." },
                    { status: 429 }
                );
            }
        }
    }

    // 2. Auth Protection for /api/* except /api/auth/*
    const isApiRoute = pathname.startsWith('/api/');
    if (isApiRoute && !isAuthRoute) {
        const sessionCookieName = process.env.NODE_ENV === "production"
            ? "__Secure-better-auth.session_token"
            : "better-auth.session_token";

        const sessionToken = request.cookies.get(sessionCookieName)?.value;

        if (!sessionToken) {
            return NextResponse.json(
                { code: "UNAUTHORIZED", message: "Missing authentication session" },
                { status: 401 }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/api/:path*',
        '/app/:path*'
    ]
};
