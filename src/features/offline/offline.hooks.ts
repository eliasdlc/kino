"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * ¿Hay conexión ahora mismo? En el servidor devuelve `true`: renderizar el
 * aviso de "sin conexión" en el HTML inicial provocaría un parpadeo en cada carga.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}
