"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToggleChapterComplete } from "./writing.hooks";
import { useCelebrateOnce } from "./celebrate";

/**
 * El check de estado del capítulo (PLAN-11 §7). Terminar un capítulo es el hito
 * más frecuente de una obra larga, así que se marca desde el propio editor y
 * entra solo al diario: no hay un formulario de hitos en ninguna parte.
 */
export function ChapterStatusToggle({
  pageId,
  systemId,
  title,
  initialCompletedAt,
  unitNoun = "capítulo",
}: {
  pageId: string;
  systemId: string;
  title: string | null;
  initialCompletedAt: Date | string | null;
  unitNoun?: string;
}) {
  const [completed, setCompleted] = useState(initialCompletedAt !== null);
  const { mutate: toggle, isPending } = useToggleChapterComplete(pageId, systemId);
  const celebrateOnce = useCelebrateOnce();

  function handleClick() {
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

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={completed}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-60",
        completed
          ? "text-primary hover:bg-accent"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
      title={completed ? `Marcar ${unitNoun} como en curso` : `Marcar ${unitNoun} como terminado`}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : completed ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <Circle className="size-3.5" />
      )}
      <span className="hidden sm:inline">{completed ? "Terminado" : "En curso"}</span>
    </button>
  );
}
