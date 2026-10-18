"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarginRow } from "@/components/ui/margin-row";
import { useToggleChapterComplete } from "./writing.hooks";
import { useCelebrateOnce } from "./celebrate";

/**
 * El check de estado del capítulo (PLAN-11 §7). Terminar un capítulo es el hito
 * más frecuente de una obra larga, así que se marca desde el propio editor y
 * entra solo al diario: no hay un formulario de hitos en ninguna parte.
 *
 * Terminado es `--ok` con su palabra, como una tarea hecha, y nunca el ámbar:
 * el ámbar es de la acción. Mientras se guarda, la palabra lo dice («Guardando»)
 * en vez de girar un icono. Dos formas: la palabra de la barra del escritorio
 * (`barra`) y la fila del panel del teléfono (`fila`), con el círculo en el
 * margen y 48 px de alto.
 */
export function ChapterStatusToggle({
  pageId,
  systemId,
  title,
  initialCompletedAt,
  unitNoun = "capítulo",
  variant = "barra",
}: {
  pageId: string;
  systemId: string;
  title: string | null;
  initialCompletedAt: Date | string | null;
  unitNoun?: string;
  variant?: "barra" | "fila";
}) {
  const [completed, setCompleted] = useState(initialCompletedAt !== null);
  const { mutate: toggle, isPending } = useToggleChapterComplete(pageId, systemId);
  const celebrateOnce = useCelebrateOnce();

  function handleClick() {
    if (isPending) return;
    const next = !completed;
    setCompleted(next);
    toggle(next, {
      onError: () => setCompleted(!next),
      onSuccess: () => {
        if (!next) return;
        celebrateOnce(`chapter:${pageId}`, {
          icon: CheckCircle2,
          title: `Terminaste «${title?.trim() || "Sin título"}»`,
          detail: "Queda en el diario de la obra.",
        });
      },
    });
  }

  const Icono = completed ? CheckCircle2 : Circle;
  const palabra = isPending ? "Guardando" : completed ? "Terminado" : "En curso";

  if (variant === "fila") {
    return (
      <MarginRow
        margin={<Icono aria-hidden className={cn("size-6", completed && "text-ok")} />}
        onClick={handleClick}
        aria-pressed={completed}
        aria-busy={isPending || undefined}
        trailing={<span className={cn(completed && "text-ok")}>{palabra}</span>}
      >
        <span className="block text-base font-semibold text-foreground">
          {completed ? `${capitalizar(unitNoun)} terminado` : `Marcar el ${unitNoun} como terminado`}
        </span>
        <span className="block text-sm text-muted-foreground">Entra al diario de la obra</span>
      </MarginRow>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={completed}
      aria-busy={isPending || undefined}
      className={cn(
        "press flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-secondary pointer-coarse:h-[2.85rem]",
        completed ? "text-ok" : "text-muted-foreground hover:text-foreground",
      )}
      title={completed ? `Marcar ${unitNoun} como en curso` : `Marcar ${unitNoun} como terminado`}
    >
      <Icono aria-hidden className="size-4" />
      {palabra}
    </button>
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
