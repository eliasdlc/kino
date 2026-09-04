import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { guardApiRequest } from "@/shared/rate-limit";

/**
 * Lo que se sirve sin sesión. Todo lo demás exige la de Clerk, o un Bearer que
 * `getAuthContext` valida más adentro.
 */
function isPublicRoute(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/docs") ||
    // Landings por arquetipo (/para/estudiantes…): son la puerta de entrada del
    // sitio. Si pasan por el gate, un visitante anónimo, o un buscador, recibe
    // un redirect a /login en vez de la página.
    pathname.startsWith("/para/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    // Catálogo visual de la UI (sin datos de usuario, noindex)
    // Pantalla de respaldo sin conexión. El service worker la precachea al
    // instalarse, y esa petición puede salir sin sesión: con el gate puesto
    // Workbox recibía el redirect a /login y guardaba eso. No lleva datos de
    // usuario: es una shell estática.
    pathname === "/offline" ||
    // El túnel por el que el navegador manda los informes a Sentry. Va aquí
    // porque el fallo más importante que puede reportar, un login roto, ocurre
    // justo cuando todavía no hay sesión.
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/api/cron/") ||
    // El conector MCP remoto se autentica solo dentro de la ruta.
    pathname.startsWith("/api/mcp") ||
    // Lo que Clerk sirve por el mismo dominio.
    pathname.startsWith("/__clerk")
  );
}

export const proxy = clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl;

  if (!isPublicRoute(pathname)) {
    const { userId } = await auth();
    // Una clave API o un token OAuth se validan más adentro. El proxy sólo
    // corta el tráfico de navegador sin sesión alguna.
    const hasBearer = request.headers.get("authorization")?.startsWith("Bearer ");

    if (!userId && !hasBearer) {
      // Las llamadas AJAX a /api/* deben recibir 401, no un redirect HTML
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Después del gate a propósito: el tráfico anónimo que no va a ninguna ruta
  // pública ya se fue con un 401 y no llega a crear filas en la tabla de
  // contadores. El acceso se cuenta por credencial contra el mismo Postgres
  // que el resto: un `Map` en memoria sería una cuota nueva por cada arranque
  // en frío.
  const rateLimited = await guardApiRequest(request);
  if (rateLimited) return rateLimited;

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
