"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarginRow } from "@/components/ui/margin-row";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { SectionHead } from "@/features/dashboard/SectionHead";
import { cn } from "@/lib/utils";
import { UNA_LINEA } from "@/shared/components/una-linea";
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
 *
 * Mover reescribe el texto con un toque, así que la hoja dice qué escena mueve
 * (su número, su capítulo y su arranque) y, al aplicar, un aviso dice qué pasó
 * con Deshacer, que aplica la operación inversa. Mientras se reescribe, la
 * pantalla lo dice en una línea que ya tenía su sitio.
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

  const capituloDeLaEscena = moving ? grid.chapters.findIndex((c) => c.chapterId === moving.chapterId) : -1;
  const scene = moving ? grid.chapters[capituloDeLaEscena]?.scenes[moving.index] : undefined;
  const tituloDelCapitulo = tituloDe(grid.chapters[capituloDeLaEscena], capituloDeLaEscena);

  return (
    <div className="space-y-6">
      <div className="pl-(--margen)">
        <p className="text-sm text-muted-foreground">{AYUDA_DEL_TABLERO}</p>
        {/* El sitio de la frase está siempre: aparecer no empuja el tablero. */}
        <p role="status" className="min-h-6 text-sm font-medium text-foreground">
          {busy ? "Reescribiendo el capítulo" : ""}
        </p>
      </div>

      {grid.chapters.map((chapter, i) => {
        const titulo = tituloDe(chapter, i);
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
              {scene ? `Mover la escena ${scene.index + 1} de ${tituloDelCapitulo}` : "Mover la escena"}
            </ResponsiveDialogTitle>
            {scene && (
              <ResponsiveDialogDescription className="line-clamp-2 font-serif text-base text-body italic">
                {scene.preview || "Escena en blanco"}
              </ResponsiveDialogDescription>
            )}
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
          {scene.wordCount.toLocaleString("es")} palabras{scene.arc ? `, ${scene.arc}` : ""}
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
 * sola petición, igual que en la rejilla, y cada una se deshace con la inversa.
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
  const [arcoNuevo, setArcoNuevo] = useState("");
  const arcs: Array<string | null> = grid.arcs.length > 0 ? [...grid.arcs, null] : [];

  function moveTo(target: PlotChapter, i: number) {
    if (target.chapterId === from.chapterId) return;
    // La escena cae al final del capítulo destino; de ahí vuelve a su sitio.
    const llega = target.scenes.length;
    onApply(
      { kind: "move", chapterId: from.chapterId, index: from.index, toChapterId: target.chapterId, toIndex: llega },
      {
        onSuccess: () =>
          avisar(`Escena movida a ${tituloDe(target, i)}`, () =>
            onApply({ kind: "move", chapterId: target.chapterId, index: llega, toChapterId: from.chapterId, toIndex: from.index }),
          ),
      },
    );
    onDone();
  }

  function setArc(arc: string | null) {
    const antes = scene.arc ?? null;
    if (antes === arc) return;
    onApply(
      { kind: "arc", chapterId: from.chapterId, index: from.index, arc },
      {
        onSuccess: () =>
          avisar(arc ? `La escena pasa al arco ${arc}` : "La escena se queda sin arco", () =>
            onApply({ kind: "arc", chapterId: from.chapterId, index: from.index, arc: antes }),
          ),
      },
    );
    onDone();
  }

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <SectionHead as="h3" title="A qué capítulo" />
        <div>
          {grid.chapters.map((c, i) => {
            const here = c.chapterId === from.chapterId;
            return (
              <MarginRow
                key={c.chapterId}
                onClick={here ? undefined : () => !busy && moveTo(c, i)}
                aria-disabled={(!here && busy) || undefined}
                aria-current={here || undefined}
                className={cn(UNA_LINEA, here && "text-muted-foreground")}
                margin={<span className="font-display text-base font-bold tabular-nums">{i + 1}</span>}
                trailing={here ? "aquí está" : <ArrowRight aria-hidden className="size-4" />}
              >
                <span className={cn("block truncate font-serif text-base", here ? "text-muted-foreground" : "text-foreground")}>
                  {tituloDe(c, i)}
                </span>
              </MarginRow>
            );
          })}
        </div>
        <p className="pl-(--margen) text-sm text-muted-foreground">
          La escena se coloca al final del capítulo que elijas.
        </p>
      </section>

      <section className="space-y-1">
        <SectionHead as="h3" title="Con qué arco" />
        {arcs.length > 0 && (
          <div>
            {arcs.map((arc) => {
              const current = (scene.arc ?? null) === arc;
              return (
                <MarginRow
                  key={arc ?? SIN_ARCO_LABEL}
                  onClick={current ? undefined : () => !busy && setArc(arc)}
                  aria-disabled={(!current && busy) || undefined}
                  aria-current={current || undefined}
                  className={UNA_LINEA}
                  margin={current ? <Check aria-hidden className="size-5 text-foreground" /> : null}
                >
                  <span className={cn("block truncate text-base text-foreground", current && "font-semibold")}>
                    {arc ?? SIN_ARCO_LABEL}
                  </span>
                </MarginRow>
              );
            })}
          </div>
        )}
        <form
          className="flex items-center gap-2 pt-2 pl-(--margen)"
          onSubmit={(e) => {
            e.preventDefault();
            const arc = arcoNuevo.trim();
            if (!arc) return;
            setArcoNuevo("");
            setArc(arc);
          }}
        >
          <Input
            value={arcoNuevo}
            onChange={(e) => setArcoNuevo(e.target.value)}
            placeholder={arcs.length > 0 ? "Otro arco" : "Nombre del primer arco"}
            aria-label="Arco nuevo"
            maxLength={60}
            className="h-[2.85rem] flex-1"
          />
          <Button type="submit" variant="outline" disabled={busy || !arcoNuevo.trim()}>
            Poner
          </Button>
        </form>
      </section>
    </div>
  );
}

/** El aviso que dice qué cambió en el texto, con la vuelta atrás a un toque. */
function avisar(mensaje: string, deshacer: () => void) {
  toast(mensaje, { action: { label: "Deshacer", onClick: deshacer }, duration: 6000 });
}

/** El nombre de un capítulo: su título o su número. */
function tituloDe(chapter: PlotChapter | undefined, i: number): string {
  return chapter?.title?.trim() || `Capítulo ${i + 1}`;
}

/** La misma frase en el tablero del teléfono y en la rejilla de escritorio. */
export const AYUDA_DEL_TABLERO =
  "Las escenas salen del texto. Moverlas reescribe el capítulo, así que no hay un orden aparte que se pueda desincronizar.";
