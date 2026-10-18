"use client";

import { Timer } from "lucide-react";
import { MarginRow } from "@/components/ui/margin-row";
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
 *
 * Dos formas: la palabra de la barra del escritorio (`barra`) y la fila del
 * panel del teléfono (`fila`), con el glifo en el margen y 48 px de alto.
 */
export function WritingSessionButton({
  pageId,
  pageTitle,
  systemId,
  variant = "barra",
}: {
  pageId: string;
  pageTitle: string | null;
  systemId: string;
  variant?: "barra" | "fila";
}) {
  const { state, openModeDialog } = useFocusTimer();
  const running = state.phase === "working" || state.phase === "break";

  if (running) return null;

  const empezar = () =>
    openModeDialog({
      id: pageId,
      title: pageTitle?.trim() || "Sin título",
      systemId,
      isPage: true,
      estimatedDuration: SYSTEM_TYPE_CONFIG.writing.focusMinutes,
    });

  if (variant === "fila") {
    return (
      <MarginRow margin={<Timer aria-hidden className="size-5" />} onClick={empezar}>
        <span className="block text-base font-semibold text-foreground">Empezar una sesión</span>
        <span className="block text-sm text-muted-foreground">
          {SYSTEM_TYPE_CONFIG.writing.focusMinutes} minutos con cuenta atrás sobre este capítulo
        </span>
      </MarginRow>
    );
  }

  return (
    <button
      type="button"
      onClick={empezar}
      className="press flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-secondary hover:text-foreground pointer-coarse:h-[2.85rem]"
      title="Iniciar una sesión de escritura cronometrada"
    >
      <Timer aria-hidden className="size-4" />
      Sesión
    </button>
  );
}
