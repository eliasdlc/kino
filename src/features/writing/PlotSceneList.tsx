"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
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
 *
 * Diario: cada capítulo abre con su numeral en el margen y su título en
 * Literata sobre un hairline; cada escena es una fila con su número en el
 * margen, el arranque del texto en Literata y Mover a 48 px. La hoja de mover
 * es una hoja con nombre de filas de margen, no una lista de cajas.
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
    <div className="space-y-6">
      <p className="pl-(--margen) text-sm text-muted-foreground">
        Las escenas salen del texto. Moverlas reescribe el capítulo, así que no hay un orden
        aparte que se pueda desincronizar.
      </p>

      {grid.chapters.map((chapter, i) => {
        const titulo = chapter.title?.trim() || `Capítulo ${i + 1}`;
        return (
          <section key={chapter.chapterId} aria-labelledby={`capitulo-${chapter.chapterId}`}>
            <div className="grid grid-cols-[var(--margen)_1fr_auto] items-baseline gap-y-1 border-b border-border pb-2">
              <span aria-hidden className="text-center font-display text-lg font-bold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <h2 id={`capitulo-${chapter.chapterId}`} className="min-w-0">
                <Link
                  href={`/systems/${systemId}/pages/${chapter.chapterId}`}
                  className="line-clamp-2 rounded-md font-serif text-lg leading-snug font-semibold text-foreground focus-ring hover:underline"
                >
                  {titulo}
                </Link>
              </h2>
              <span className="pl-2.5 text-sm text-muted-foreground tabular-nums">
                {chapter.scenes.length === 1 ? "1 escena" : `${chapter.scenes.length} escenas`}
              </span>
            </div>

            {chapter.scenes.length === 0 ? (
              <p className="py-3 pl-(--margen) text-sm text-muted-foreground">Sin escenas todavía</p>
            ) : (
              chapter.scenes.map((s) => (
                <SceneRow
                  key={s.index}
                  scene={s}
                  chapterTitle={titulo}
                  busy={busy}
                  onMove={() => setMoving({ chapterId: chapter.chapterId, index: s.index })}
                />
              ))
            )}
          </section>
        );
      })}

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
  chapterTitle,
  busy,
  onMove,
}: {
  scene: PlotScene;
  chapterTitle: string;
  busy: boolean;
  onMove: () => void;
}) {
  return (
    <div className="grid grid-cols-[var(--margen)_1fr_auto] items-start gap-y-1 border-b border-border py-2.5 last:border-b-0">
      <span aria-hidden className="pt-0.5 text-center text-sm font-semibold text-muted-foreground tabular-nums">
        {scene.index + 1}
      </span>
      <div className="min-w-0">
        <p className="line-clamp-2 font-serif text-base text-body">{scene.preview || "Escena en blanco"}</p>
        <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
          {scene.wordCount.toLocaleString("es")} palabras{scene.arc ? `, ${scene.arc}` : ", sin arco"}
        </p>
      </div>
      {/* Esta acción reescribe el manuscrito: 48 px y un nombre que dice cuál. */}
      <Button
        variant="outline"
        className="ml-2.5 shrink-0"
        disabled={busy}
        onClick={onMove}
        aria-label={`Mover la escena ${scene.index + 1} de ${chapterTitle}`}
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
    <div className="space-y-5">
      <section className="space-y-1">
        <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          A qué capítulo
        </h3>
        <div>
          {grid.chapters.map((c, i) => {
            const here = c.chapterId === from.chapterId;
            return (
              <SheetRow
                key={c.chapterId}
                onClick={() => moveTo(c)}
                disabled={busy || here}
                current={here}
                margin={
                  <span className="font-display text-base font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                }
                trailing={here ? "aquí está" : <ArrowRight aria-hidden className="size-4" />}
              >
                <span className={cn("block truncate font-serif text-base", here ? "text-muted-foreground" : "text-foreground")}>
                  {c.title?.trim() || `Capítulo ${i + 1}`}
                </span>
              </SheetRow>
            );
          })}
        </div>
        <p className="pl-(--margen) text-sm text-muted-foreground">
          La escena se coloca al final del capítulo que elijas.
        </p>
      </section>

      <section className="space-y-1">
        <h3 className="border-b border-border pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Con qué arco
        </h3>
        <div>
          {arcs.map((arc) => {
            const current = (scene.arc ?? null) === arc;
            return (
              <SheetRow
                key={arc ?? SIN_ARCO_LABEL}
                onClick={() => setArc(arc)}
                disabled={busy || current}
                current={current}
                margin={current ? <Check aria-hidden className="size-5 text-foreground" /> : null}
              >
                <span className={cn("block truncate text-base", current ? "font-semibold text-foreground" : "text-foreground")}>
                  {arc ?? SIN_ARCO_LABEL}
                </span>
              </SheetRow>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/**
 * Una opción de la hoja de mover: la rejilla de la fila de margen en un botón
 * de verdad, que se deshabilita donde la escena ya está (un `div` no se puede
 * deshabilitar, y quien navega con teclado tiene que saber por qué no va).
 */
function SheetRow({
  margin,
  trailing,
  current,
  disabled,
  onClick,
  children,
}: {
  margin: React.ReactNode;
  trailing?: React.ReactNode;
  current: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={current || undefined}
      className="press grid min-h-[3.4rem] w-full grid-cols-[var(--margen)_1fr_auto] items-center border-b border-border text-left transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring last:border-b-0 enabled:hover:bg-sf2/60 disabled:cursor-default"
    >
      <span className="flex justify-center text-muted-foreground">{margin}</span>
      <span className="block min-w-0 py-2">{children}</span>
      {trailing !== undefined && (
        <span className="pl-2.5 text-right text-sm whitespace-nowrap text-muted-foreground">{trailing}</span>
      )}
    </button>
  );
}
