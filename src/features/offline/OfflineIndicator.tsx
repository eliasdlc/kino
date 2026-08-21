"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useOnlineStatus, usePendingCreationCount } from "./offline.hooks";

/**
 * Indicador de estado de red (KIN-57).
 *
 * Discreto a propósito: una píldora pequeña abajo a la izquierda que **sólo
 * aparece cuando hay algo que decir** — no hay red, o hay capturas esperando a
 * subir. Un aviso permanente y grande convertiría una degradación menor (seguís
 * pudiendo capturar) en algo que parece una avería.
 *
 * Desaparece solo: cuando vuelve la conexión y la cola se vacía, no queda nada
 * que confirmar ni que cerrar.
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const pending = usePendingCreationCount();

  if (isOnline && pending === 0) return null;

  const syncing = isOnline && pending > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 z-40 md:bottom-4 pointer-events-none"
    >
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
        {syncing ? (
          <>
            <RefreshCw size={12} className="animate-spin" aria-hidden />
            <span>Subiendo {pending}…</span>
          </>
        ) : (
          <>
            <CloudOff size={12} aria-hidden />
            <span>
              Sin conexión
              {pending > 0 && ` · ${pending} por subir`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
