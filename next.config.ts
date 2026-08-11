import type { NextConfig } from "next";
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

export default withPWA(nextConfig);