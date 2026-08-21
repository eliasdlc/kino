"use client";

import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsPending } from "./offline.hooks";

/**
 * Marca de "todavía no ha subido" (KIN-57).
 *
 * No renderiza nada cuando la entidad ya está confirmada, así que se puede
 * colocar sin condicionales en cualquier fila. Sabe si algo está pendiente porque
 * el id del placeholder es el `clientRequestId` que sigue en la cola.
 *
 * Deliberadamente pequeño y sin color de alarma: lo capturado sin red no está en
 * riesgo, sólo está esperando. Un badge rojo diría lo contrario.
 */
export function PendingSyncBadge({ id, className }: { id: string; className?: string }) {
  const isPending = useIsPending(id);

  if (!isPending) return null;

  return (
    <span
      title="Guardada en este dispositivo · se subirá al volver la conexión"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5",
        "text-[10px] font-medium text-muted-foreground bg-white/[0.06]",
        className,
      )}
    >
      <CloudOff size={10} aria-hidden />
      <span className="sr-only sm:not-sr-only">Sin subir</span>
    </span>
  );
}
