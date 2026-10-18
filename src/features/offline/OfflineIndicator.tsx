"use client";

import { CloudOff } from "lucide-react";
import { useOnlineStatus } from "./offline.hooks";

/**
 * Indicador de estado de red (KIN-57).
 *
 * Discreto a propósito: una píldora pequeña abajo a la izquierda que **sólo
 * aparece cuando hay algo que decir**: no hay red, o hay capturas esperando a
 * subir. Un aviso permanente y grande convertiría una degradación menor (seguís
 * pudiendo capturar) en algo que parece una avería.
 *
 * Desaparece solo: cuando vuelve la conexión y la cola se vacía, no queda nada
 * que confirmar ni que cerrar.
 *
 * Es papel con hairline, como el pie: sin desenfoque, sin borde blanco y sin
 * sombra. La palabra va en tinta suave y el glifo en mute; no es una alarma.
 */
export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(var(--kino-bottom-chrome)+0.5rem)] left-[max(1rem,env(safe-area-inset-left))] z-(--z-modal) md:bottom-4 pointer-events-none"
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-body">
        <CloudOff className="size-4 text-muted-foreground" aria-hidden />
        <span>Sin conexión</span>
      </div>
    </div>
  );
}
