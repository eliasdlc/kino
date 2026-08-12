import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { guardApiRequest } from "@/shared/rate-limit";

// Limitador por IP, en memoria, sólo para `/api/auth/*`. Sigue siendo por
// instancia — N arranques en frío son N cuotas — y eso aquí es tolerable: en
// login todavía no hay identidad que contar, la IP es lo único disponible, y
// meterle un roundtrip a Postgres a la ruta más sensible del sitio para frenar
// fuerza bruta es pagar latencia por algo que el WAF de Vercel corta mejor.
//
// El resto de la API ya no depende de esto: las mutaciones y `/api/mcp` pasan
// por el contador compartido en Postgres de `@/shared/rate-limit` (KIN-149),
// que sí es consistente entre instancias y cuenta por identidad.
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
    // Landings por arquetipo (/para/estudiantes…): son la puerta de entrada del
    // sitio. Si pasan por el gate, un visitante anónimo — o un buscador — recibe
    // un redirect a /login en vez de la página.
    pathname.startsWith("/para/") ||
    pathname.startsWith("/login") ||
    // Catálogo visual de la UI (sin datos de usuario, noindex)
    pathname.startsWith("/system-design") ||
    // Pantalla de respaldo sin conexión (KIN-57). El service worker la precachea
    // al instalarse, y esa petición puede salir sin sesión — con el gate puesto
    // Workbox recibía el redirect a /login y guardaba eso (o fallaba la
    // instalación entera). No lleva datos de usuario: es una shell estática.
    pathname === "/offline" ||
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

  // Después del gate a propósito: el tráfico anónimo ya se fue con un 401 y no
  // llega a crear filas en la tabla de contadores. `/api/mcp` sí pasa por aquí
  // aunque sea "pública" — se autentica sola por OAuth y es justo la ruta que
  // el ticket exige cubrir.
  const rateLimited = await guardApiRequest(request);
  if (rateLimited) return rateLimited;

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
