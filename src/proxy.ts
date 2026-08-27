import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { guardApiRequest } from "@/shared/rate-limit";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    // Recuperación de contraseña: quien llega aquí no tiene sesión por definición.
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/api/auth") ||
    // El túnel por el que el navegador manda los informes a Sentry (KIN-163).
    // Va aquí porque el fallo más importante que puede reportar —un login roto—
    // ocurre justo cuando todavía no hay sesión: con el gate puesto, el informe
    // recibiría un 401 y nadie se enteraría del error que dejó a la gente fuera.
    pathname.startsWith("/monitoring") ||
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

  // Después del gate a propósito: el tráfico anónimo que no va a ninguna ruta
  // pública ya se fue con un 401 y no llega a crear filas en la tabla de
  // contadores. Las que sí son públicas — `/api/mcp`, que se autentica sola por
  // OAuth, y `/api/auth/*`, donde todavía no hay con quién autenticarse — pasan
  // por aquí igual, y son justo las dos que hay que cubrir.
  //
  // El acceso se cuenta por IP contra el mismo Postgres que el resto (KIN-161).
  // Antes vivía en un `Map` de este módulo, o sea una cuota nueva por cada
  // arranque en frío: en Vercel eso son muchos más intentos que los anunciados.
  // El precio es un roundtrip en `/api/auth/*`, y a cambio el límite existe.
  //
  // Aquí sólo se ve la IP. Cuántas veces se ha fallado *contra una cuenta*
  // necesita el correo del cuerpo de la request, y eso se cuenta en el hook de
  // `sign-in-attempts.ts`.
  const rateLimited = await guardApiRequest(request);
  if (rateLimited) return rateLimited;

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
