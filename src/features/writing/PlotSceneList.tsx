"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import type { usePlotOperation } from "./writing.hooks";
import type { PlotChapter, PlotGrid, PlotScene } from "./writing.plot";

/**
 * El tablero de escenas en un teléfono (KIN-170).
 *
 * La rejilla de capítulo x arco necesita ancho: es una tabla con columnas de
 * 224px y sólo cabe desplazándola en horizontal, que es justo lo que el proyecto
 * evita en táctil. Aquí la misma información se lee en vertical, agrupada por
 * capítulo, y el arco pasa de ser una fila de la rejilla a una etiqueta de cada
 * escena.
 *
 * Mover **reescribe el texto** de los capítulos implicados, igual que en la
 * rejilla: las dos vistas hablan con las mismas operaciones de `usePlotOperation`
 * y no hay un orden guardado aparte que pueda divergir de lo escrito.
 *
 * Sin arrastre, a propósito. La rejilla ya decía que la vía explícita tiene que
 * existir siempre porque un arrastre accidental reescribe el manuscrito; en una
 * pantalla táctil esa vía no es la alternativa, es la única.
 */

type Apply = ReturnType<typeof usePlotOperation>["mutate"];

const SIN_ARCO_LABEL = "Sin arco";

export function PlotSceneList({
  grid,
  systemId,
  busy,
  onApply,
}: {
  grid: PlotGrid;
  systemId: string;
  busy: boolean;
  onApply: Apply;
}) {
  const [moving, setMoving] = useState<{ chapterId: string; index: number } | null>(null);

  const scene = moving
    ? grid.chapters.find((c) => c.chapterId === moving.chapterId)?.scenes[moving.index]
    : undefined;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Las escenas salen del texto. Moverlas reescribe el capítulo, así que no hay un orden
        aparte que se pueda desincronizar.
      </p>

      {grid.chapters.map((chapter, i) => (
        <section key={chapter.chapterId} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={`/systems/${systemId}/pages/${chapter.chapterId}`}
              className="min-w-0 truncate text-sm font-medium hover:underline"
            >
              {chapter.title?.trim() || `Capítulo ${i + 1}`}
            </Link>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
              {chapter.scenes.length === 1 ? "1 escena" : `${chapter.scenes.length} escenas`}
            </span>
          </div>

          {chapter.scenes.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground/60">
              Sin escenas todavía
            </p>
          ) : (
            chapter.scenes.map((s) => (
              <SceneRow
                key={s.index}
                scene={s}
                busy={busy}
                onMove={() => setMoving({ chapterId: chapter.chapterId, index: s.index })}
              />
            ))
          )}
        </section>
      ))}

      <ResponsiveDialog open={moving !== null} onOpenChange={(o) => !o && setMoving(null)}>
        <ResponsiveDialogContent className="max-w-md" mobileClassName="max-h-[80dvh]">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {scene ? `Mover la escena ${scene.index + 1}` : "Mover la escena"}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          {moving && scene && (
            <MovePanel
              grid={grid}
              from={moving}
              scene={scene}
              busy={busy}
              onApply={onApply}
              onDone={() => setMoving(null)}
            />
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}

function SceneRow({
  scene,
  busy,
  onMove,
}: {
  scene: PlotScene;
  busy: boolean;
  onMove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border bg-card p-3">
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            Escena {scene.index + 1} · {scene.wordCount.toLocaleString("es")} palabras
          </span>
          {scene.arc && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-foreground">
              <Tag className="size-2.5" />
              {scene.arc}
            </span>
          )}
        </p>
        <p className="line-clamp-3 text-xs text-muted-foreground">
          {scene.preview || "Escena en blanco"}
        </p>
      </div>
      {/* 44px de alto: el mínimo táctil, y esta acción reescribe el manuscrito. */}
      <Button
        variant="outline"
        size="sm"
        className="h-11 shrink-0 px-3"
        disabled={busy}
        onClick={onMove}
      >
        Mover
      </Button>
    </div>
  );
}

/**
 * Las dos operaciones que la rejilla ofrece con arrastre y con chevrons, aquí como
 * dos listas: a qué capítulo va la escena y con qué arco se queda. Cada una es una
 * sola petición, igual que en la rejilla.
 */
function MovePanel({
  grid,
  from,
  scene,
  busy,
  onApply,
  onDone,
}: {
  grid: PlotGrid;
  from: { chapterId: string; index: number };
  scene: PlotScene;
  busy: boolean;
  onApply: Apply;
  onDone: () => void;
}) {
  const arcs: Array<string | null> = [...grid.arcs, null];

  function moveTo(target: PlotChapter) {
    if (target.chapterId === from.chapterId) return;
    onApply({
      kind: "move",
      chapterId: from.chapterId,
      index: from.index,
      toChapterId: target.chapterId,
      toIndex: target.scenes.length,
    });
    onDone();
  }

  function setArc(arc: string | null) {
    if ((scene.arc ?? null) === arc) return;
    onApply({ kind: "arc", chapterId: from.chapterId, index: from.index, arc });
    onDone();
  }

  return (
    <div className="space-y-5 overflow-y-auto px-4 pb-6 sm:px-0 sm:pb-0">
      <section>
        <p className="mb-2 text-xs font-medium text-muted-foreground">A qué capítulo</p>
        <div className="space-y-1">
          {grid.chapters.map((c, i) => {
            const here = c.chapterId === from.chapterId;
            return (
              <button
                key={c.chapterId}
                type="button"
                disabled={busy || here}
                onClick={() => moveTo(c)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  here ? "bg-muted text-muted-foreground" : "hover:bg-accent",
                )}
              >
                <span className="min-w-0 flex-1 truncate">
                  {c.title?.trim() || `Capítulo ${i + 1}`}
                </span>
                {here ? (
                  <span className="shrink-0 text-xs">aquí está</span>
                ) : (
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          La escena se coloca al final del capítulo que elijas.
        </p>
      </section>

      <section>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Con qué arco</p>
        <div className="space-y-1">
          {arcs.map((arc) => {
            const current = (scene.arc ?? null) === arc;
            return (
              <button
                key={arc ?? SIN_ARCO_LABEL}
                type="button"
                disabled={busy || current}
                onClick={() => setArc(arc)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  current ? "bg-muted text-muted-foreground" : "hover:bg-accent",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{arc ?? SIN_ARCO_LABEL}</span>
                {current && <Check className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
