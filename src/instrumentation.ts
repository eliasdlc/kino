import * as Sentry from "@sentry/nextjs";

/**
 * Arranque del reporte de errores en el servidor (KIN-163).
 *
 * Next llama a `register` una vez por runtime, antes de servir nada. La config
 * se carga con un import dinámico y no arriba, porque la de Node arrastra el
 * SDK entero y en edge no cabe.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Los errores que Next captura por su cuenta: los que revientan al renderizar
 * un server component, y los que escapan de una ruta sin pasar por nuestro
 * mapeo. Sin este hook nunca llegarían, porque no cruzan ningún `catch` nuestro.
 */
export const onRequestError = Sentry.captureRequestError;
