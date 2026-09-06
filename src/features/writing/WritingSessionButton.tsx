"use client";

import { Timer } from "lucide-react";
import { useFocusTimer } from "@/features/tasks/FocusTimerProvider";
import { SYSTEM_TYPE_CONFIG } from "@/shared/lib/system-types";

/**
 * Lanza una sesión de escritura cronometrada sobre el capítulo abierto (§9). Es
 * el mismo focus timer de las tareas: mismos modos, mismo widget, mismo recap
 * de energía: apuntando a una page en vez de a un task.
 *
 * El registro de palabras no depende de este botón: el server detecta la sesión
 * al guardar. Esto añade el ritual (cuenta regresiva, campana, cierre), que es
 * lo que sostiene el hábito.
 */
export function WritingSessionButton({
  pageId,
  pageTitle,
  systemId,
}: {
  pageId: string;
  pageTitle: string | null;
  systemId: string;
}) {
  const { state, openModeDialog } = useFocusTimer();
  const running = state.phase === "working" || state.phase === "break";

  if (running) return null;

  return (
    <button
      type="button"
      onClick={() =>
        openModeDialog({
          id: pageId,
          title: pageTitle?.trim() || "Sin título",
          systemId,
          isPage: true,
          estimatedDuration: SYSTEM_TYPE_CONFIG.writing.focusMinutes,
        })
      }
      className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title="Iniciar una sesión de escritura cronometrada"
    >
      <Timer className="size-3.5" />
      <span className="hidden sm:inline">Sesión</span>
    </button>
  );
}
