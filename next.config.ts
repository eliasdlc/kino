import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import withPWAInit from "@ducanh2912/next-pwa";

// KIN-57 · Un solo service worker. Antes convivían el generado por next-pwa y
// un `public/kino-sw.js` escrito a mano que sólo se registraba al activar las
// notificaciones — dos SW peleando por el control, y la pantalla `/offline`
// existiendo únicamente para quien concedía permiso de push.
//
// Ahora manda next-pwa y lo que era propio del SW manual vive aquí:
//  - los handlers de `push` / `notificationclick` en `worker/index.js`, que
//    next-pwa compila e importa dentro de su `sw.js`;
//  - el precache de `/offline` vía `fallbacks.document`, que se aplica a todo
//    el mundo porque el registro lo hace el propio plugin (`register: true`).
//
// Ojo al probar: `disable` apaga el plugin en desarrollo, así que nada de esto
// existe con `pnpm dev`. La captura offline se verifica con `pnpm build && pnpm start`
// o contra el preview de Vercel.
//
// Y ojo con el bundler: next-pwa es un plugin de **webpack**, y Next 16 buildea
// con Turbopack por defecto. Con Turbopack el plugin nunca corre y el build sale
// verde sin emitir `public/sw.js` — sin aviso, sin service worker, sin offline.
// Por eso `pnpm build` lleva `--webpack`. Si algún día se quiere el build con
// Turbopack, hay que migrar a `@serwist/next` primero.
const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development", // Desactivar en desarrollo para evitar caché molesto
  register: true,
  // Cachea las navegaciones del App Router para que el shell de captura siga
  // disponible sin red, no sólo la ruta con la que se entró.
  cacheOnFrontEndNav: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    skipWaiting: true,
  }
});

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {

  },
  reactStrictMode: true,
  // Workspace package shipping ESM tool definitions reused by the /api/mcp route.
  transpilePackages: ["@kino-app/mcp"],
};

// Sentry envuelve por fuera de next-pwa: su plugin de webpack tiene que ver el
// bundle ya generado para poder subirle los sourcemaps. Al revés, next-pwa
// recibiría una config que no reconoce.
//
// Sin `SENTRY_AUTH_TOKEN` no se sube nada y el build sale igual de verde, que es
// el estado mientras la clave no esté cargada en Vercel.
export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // El build no debe llenarse de avisos por una credencial que aún no existe.
  silent: !process.env.CI,
  // Los sourcemaps se suben y se borran del bundle público: sirven para leer
  // una traza en Sentry, no para que cualquiera lea el código en el navegador.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Un proxy propio para que los bloqueadores de anuncios no se coman los
  // informes, que es la causa más común de "Sentry no reporta nada".
  tunnelRoute: "/monitoring",
  // Quita del bundle los logs de depuración del propio SDK.
  webpack: { treeshake: { removeDebugLogging: true } },
});