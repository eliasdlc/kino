import * as Sentry from "@sentry/nextjs";
import { sentryBaseOptions } from "@/shared/observability/sentry-options";

/**
 * Reporte en el navegador (KIN-163). Next carga este archivo antes que
 * cualquier código de la app, así que un error del arranque también llega.
 */
Sentry.init({
  ...sentryBaseOptions,
  // Sin replay ni sesiones: grabar la pantalla de alguien escribiendo su novela
  // es justo lo que el ticket pide evitar.
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
});

/** Enlaza las navegaciones del App Router con el error que ocurra después. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
