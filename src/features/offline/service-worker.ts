"use client";

import { useEffect } from "react";

/** Ruta del service worker manual que existió hasta KIN-57. */
const LEGACY_SW_PATH = "/kino-sw.js";

/**
 * Desregistra el service worker viejo en los navegadores que ya lo tenían.
 *
 * Sin esto, quien hubiera activado las notificaciones antes de este ticket se
 * queda con dos service workers registrados a la vez: el suyo, ya sin archivo que
 * lo respalde, y el de next-pwa. Dos SW compitiendo por controlar la misma página
 * es la clase de bug que sólo aparece en el dispositivo de una persona y no hay
 * forma de reproducir.
 *
 * Es una limpieza de un solo uso: cuando ya no quede ningún registro viejo, este
 * hook no hace nada y se puede borrar.
 */
export function useUnregisterLegacyServiceWorker(): void {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        if (cancelled) return;
        for (const registration of registrations) {
          const scriptUrl =
            registration.active?.scriptURL ??
            registration.installing?.scriptURL ??
            registration.waiting?.scriptURL ??
            "";
          if (scriptUrl.includes(LEGACY_SW_PATH)) {
            void registration.unregister();
          }
        }
      })
      .catch(() => {
        // Si el navegador no deja enumerar registros, no hay nada que hacer y
        // tampoco nada que romper: next-pwa registra el suyo igualmente.
      });

    return () => {
      cancelled = true;
    };
  }, []);
}
