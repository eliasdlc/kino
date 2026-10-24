"use client";

import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEVERITY_ORDER, severityCount } from "./review-labels";
import type { ReviewProgress } from "./reviews.types";

/**
 * La barra de la revisión. Mide la revisión, nunca el documento: dice cuánto
 * queda por cerrar, no qué nota merece el texto.
 *
 * Se llena por peso, no por cuenta, para que cerrar el argumento que no se
 * sostiene avance más que cerrar tres comas. Y lo que dice con palabras es lo
 * que falta («quedan 2 críticos y 1 detalle»), porque la recta final se recorre
 * más rápido cuando se ve lo cerca que está, y un porcentaje no lo dice.
 *
 * Crece por `transform` y no por `width`, que es una propiedad de layout.
 */
export function ReviewProgressBar({ progress, className }: { progress: ReviewProgress; className?: string }) {
  const done = progress.total > 0 && progress.open === 0;
  const quedan = SEVERITY_ORDER.filter((s) => progress.openBySeverity[s] > 0).map((s) =>
    severityCount(s, progress.openBySeverity[s]),
  );

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-semibold text-foreground tabular-nums">
        {done ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--ok)]">
            <CircleCheck className="size-4" aria-hidden />
            Todo cerrado
          </span>
        ) : (
          <>
            {progress.closed} de {progress.total} cerrados
          </>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Avance de la revisión"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.fraction * 100)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full origin-left rounded-full transition-[transform,background-color] duration-500 ease-out",
            done ? "bg-[var(--ok)]" : "bg-primary",
          )}
          style={{ transform: `scaleX(${progress.fraction})` }}
        />
      </div>
      {!done && quedan.length > 0 && <p className="text-xs text-muted-foreground">Quedan {juntar(quedan)}</p>}
    </div>
  );
}

/** «a», «a y b», «a, b y c». */
function juntar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}
