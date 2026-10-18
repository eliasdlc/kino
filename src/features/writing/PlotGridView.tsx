"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { AYUDA_DEL_TABLERO, PlotSceneList } from "./PlotSceneList";
import { usePlotGrid, usePlotOperation } from "./writing.hooks";
import type { PlotChapter, PlotGrid, PlotScene } from "./writing.plot";

/**
 * Plot grid (KIN-141): las escenas de la obra en una rejilla de capítulo × arco.
 * Reordenar la estructura moviendo escenas en vez de cortando y pegando texto.
 *
 * Diario también aquí: cada columna es un capítulo con su numeral y un hairline,
 * y cada escena una fila con su número en el margen y su arranque en Literata,
 * el mismo dibujo que el tablero del teléfono. Sin cajas ni tarjetas.
 *
 * Mover una escena **reescribe el texto** de los capítulos implicados. No hay un
 * orden persistido en paralelo que pueda divergir de lo escrito: las escenas se
 * siguen derivando del contenido, como desde W3.
 *
 * Se arrastra, pero también se mueve con botones. No es solo por accesibilidad:
 * un arrastre accidental aquí reescribe el manuscrito, así que la vía explícita
 * tiene que existir siempre y funcionar igual en un móvil.
 *
 * En un teléfono la rejilla no cabe (columnas de 224px que sólo se alcanzan
 * desplazando en horizontal) así que ahí se sirve `PlotSceneList`, la misma
 * información en vertical y sin arrastre (KIN-170). Los datos y las operaciones
 * se resuelven aquí para las dos: una sola fuente, un solo estado de carga.
 *
 * Mientras una operación reescribe el texto, la pantalla lo dice con palabras
 * («Reescribiendo el capítulo») y no con un icono que gira; cada fila de arco
 * dice cuántas escenas y palabras lleva, que es el estado del arco de un
 * vistazo.
 */

const SIN_ARCO = "__sin_arco__";

interface SceneKey {
  chapterId: string;
  index: number;
}

const keyOf = (k: SceneKey) => `${k.chapterId}:${k.index}`;

export function PlotGridView({
  systemId,
  folderId,
}: {
  systemId: string;
  folderId: string;
}) {
  const { data, isLoading } = usePlotGrid(folderId);
  const { mutate: apply, isPending } = usePlotOperation(folderId);
  const [dragging, setDragging] = useState<SceneKey | null>(null);
  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Delay en touch para no pelear con el scroll de la rejilla.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const rows = useMemo(() => buildRows(data), [data]);

  function onDragStart(event: DragStartEvent) {
    setDragging((event.active.data.current as { scene?: SceneKey })?.scene ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    const from = (event.active.data.current as { scene?: SceneKey })?.scene;
    const target = event.over?.data.current as
      | { chapterId: string; arc: string | null }
      | undefined;
    setDragging(null);
    if (!from || !target || !data) return;

    const destination = data.chapters.find((c) => c.chapterId === target.chapterId);
    const origin = data.chapters.find((c) => c.chapterId === from.chapterId);
    if (!destination || !origin) return;

    const current = origin.scenes[from.index];
    if (!current) return;
    // Soltar donde ya estaba no es un cambio; no hay por qué reescribir el texto.
    if (from.chapterId === target.chapterId && (current.arc ?? null) === target.arc) return;

    if (from.chapterId === target.chapterId) {
      apply({ kind: "arc", chapterId: from.chapterId, index: from.index, arc: target.arc });
      return;
    }

    // Soltar en una celda coloca la escena al final de ese capítulo con el arco
    // de esa fila. Va como una sola operación: son un solo gesto del usuario, y
    // dos peticiones podrían cruzarse.
    apply({
      kind: "move",
      chapterId: from.chapterId,
      index: from.index,
      toChapterId: target.chapterId,
      toIndex: destination.scenes.length,
      arc: target.arc,
    });
  }

  if (isLoading) {
    // La forma de lo que llega: un capítulo con sus escenas, quieta.
    return (
      <div aria-busy className="space-y-2">
        <div className="border-b border-border pb-2">
          <Skeleton className="h-6 w-56" />
        </div>
        <Skeleton className="h-[4.6rem] w-full rounded-md" />
        <Skeleton className="h-[4.6rem] w-full rounded-md" />
      </div>
    );
  }

  if (!data || data.chapters.length === 0) {
    return (
      <Empty
        title="Esta obra todavía no tiene capítulos"
        hint="El tablero muestra las escenas de cada capítulo. Escribe uno y vuelve."
      />
    );
  }

  const totalScenes = data.chapters.reduce((sum, c) => sum + c.scenes.length, 0);
  if (totalScenes === 0) {
    return (
      <Empty
        title="Todavía no hay escenas"
        hint="Las escenas se derivan del texto: inserta un separador de escena en un capítulo y aparecerán aquí."
      />
    );
  }

  if (isMobile) {
    return <PlotSceneList grid={data} systemId={systemId} busy={isPending} onApply={apply} />;
  }

  const porArco = arcStats(data);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-3">
        <div className="flex min-h-9 items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{AYUDA_DEL_TABLERO}</p>
          <p role="status" className="shrink-0 text-sm font-medium text-foreground">
            {isPending ? "Reescribiendo el capítulo" : ""}
          </p>
        </div>

        <div className="overflow-x-auto pb-3 [scrollbar-gutter:stable]">
          <table className="w-max border-separate border-spacing-x-4 border-spacing-y-0">
            <thead>
              <tr>
                <th className="w-36 border-b border-input pb-2 text-left align-bottom text-sm font-semibold text-muted-foreground">
                  Arco
                </th>
                {data.chapters.map((chapter, i) => (
                  <th key={chapter.chapterId} className="w-64 min-w-64 max-w-64 border-b border-input pb-2 text-left align-top font-normal">
                    <span className="block font-display text-base font-bold text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    <Link
                      href={`/systems/${systemId}/pages/${chapter.chapterId}`}
                      className="block rounded-md font-serif text-base font-semibold text-foreground focus-ring hover:underline"
                    >
                      {chapter.title?.trim() || `Capítulo ${i + 1}`}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {chapter.scenes.length === 1 ? "1 escena" : `${chapter.scenes.length} escenas`}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((arc) => (
                <tr key={arc ?? SIN_ARCO}>
                  <th className="w-36 border-b border-border py-2 align-top text-left font-normal">
                    <span className="block text-sm font-semibold text-foreground">{arc ?? "Sin arco"}</span>
                    <span className="block text-sm text-muted-foreground tabular-nums">
                      {describirArco(porArco.get(arc ?? SIN_ARCO))}
                    </span>
                  </th>
                  {data.chapters.map((chapter) => (
                    <Cell
                      key={chapter.chapterId}
                      chapter={chapter}
                      arc={arc}
                      grid={data}
                      busy={isPending}
                      onApply={apply}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DragOverlay>
        {dragging && (
          // La escena que viaja: la misma fila, en papel y con su hairline.
          <div className="line-clamp-3 max-w-56 border-y border-input bg-background py-2 pl-3 font-serif text-sm text-body">
            {sceneAt(data, dragging)?.preview || "Escena en blanco"}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return <EmptyState title={title} description={hint} />;
}

type EstadoDeArco = { escenas: number; palabras: number };

/** Cuántas escenas y palabras lleva cada arco: el estado del arco de un vistazo. */
export function arcStats(grid: PlotGrid): Map<string, EstadoDeArco> {
  const porArco = new Map<string, EstadoDeArco>();
  for (const chapter of grid.chapters) {
    for (const scene of chapter.scenes) {
      const clave = scene.arc ?? SIN_ARCO;
      const actual = porArco.get(clave) ?? { escenas: 0, palabras: 0 };
      porArco.set(clave, { escenas: actual.escenas + 1, palabras: actual.palabras + scene.wordCount });
    }
  }
  return porArco;
}

export function describirArco(estado: EstadoDeArco | undefined): string {
  if (!estado || estado.escenas === 0) return "sin escenas";
  const escenas = estado.escenas === 1 ? "1 escena" : `${estado.escenas} escenas`;
  return `${escenas}, ${estado.palabras.toLocaleString("es")} palabras`;
}

/** Filas de la rejilla: los arcos usados y siempre la fila de los que no tienen. */
function buildRows(grid: PlotGrid | undefined): Array<string | null> {
  if (!grid) return [null];
  return [...grid.arcs, null];
}

function sceneAt(grid: PlotGrid, key: SceneKey): PlotScene | undefined {
  return grid.chapters.find((c) => c.chapterId === key.chapterId)?.scenes[key.index];
}

type Apply = ReturnType<typeof usePlotOperation>["mutate"];

function Cell({
  chapter,
  arc,
  grid,
  busy,
  onApply,
}: {
  chapter: PlotChapter;
  arc: string | null;
  grid: PlotGrid;
  busy: boolean;
  onApply: Apply;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${chapter.chapterId}::${arc ?? SIN_ARCO}`,
    data: { chapterId: chapter.chapterId, arc },
  });

  const scenes = chapter.scenes.filter((s) => (s.arc ?? null) === arc);

  return (
    <td
      ref={setNodeRef}
      className={cn(
        // Una celda es un trozo de columna bajo su hairline; al pasar una escena
        // por encima se tiñe de la superficie, sin caja que aparezca.
        "min-w-56 border-b border-border align-top transition-[background-color] duration-(--dur-toque) ease-(--ease-pluma)",
        isOver && "bg-sf2",
      )}
    >
      <div>
        {scenes.map((scene) => (
          <SceneCard
            key={scene.index}
            scene={scene}
            chapter={chapter}
            grid={grid}
            busy={busy}
            onApply={onApply}
          />
        ))}
        {scenes.length === 0 && (
          <p className="py-3 pl-(--margen) text-sm text-muted-foreground">Sin escenas</p>
        )}
      </div>
    </td>
  );
}

function SceneCard({
  scene,
  chapter,
  grid,
  busy,
  onApply,
}: {
  scene: PlotScene;
  chapter: PlotChapter;
  grid: PlotGrid;
  busy: boolean;
  onApply: Apply;
}) {
  const key: SceneKey = { chapterId: chapter.chapterId, index: scene.index };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: keyOf(key),
    data: { scene: key },
  });

  const position = grid.chapters.findIndex((c) => c.chapterId === chapter.chapterId);
  const prevChapter = grid.chapters[position - 1];
  const nextChapter = grid.chapters[position + 1];

  function moveToChapter(target: PlotChapter | undefined) {
    if (!target) return;
    onApply({
      kind: "move",
      chapterId: chapter.chapterId,
      index: scene.index,
      toChapterId: target.chapterId,
      toIndex: target.scenes.length,
    });
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group grid grid-cols-[var(--margen)_1fr] border-b border-border py-2.5 text-sm last:border-b-0 transition-opacity duration-(--dur-toque) ease-(--ease-pluma)",
        isDragging && "opacity-40",
      )}
    >
      <span aria-hidden className="pt-0.5 text-center text-sm font-semibold text-muted-foreground tabular-nums">
        {scene.index + 1}
      </span>
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Arrastrar la escena ${scene.index + 1} de ${chapter.title ?? "el capítulo"}`}
        className="min-w-0 cursor-grab rounded-sm text-left focus-ring active:cursor-grabbing"
      >
        <span className="line-clamp-4 font-serif text-base text-body">
          {scene.preview || "Escena en blanco"}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground tabular-nums">
          {scene.wordCount.toLocaleString("es")} palabras
        </span>
      </button>

      <div className="col-start-2 mt-1 -ml-2 flex items-center gap-0.5 transition-opacity duration-(--dur-toque) ease-(--ease-pluma) md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 pointer-coarse:size-[2.85rem]"
          disabled={!prevChapter || busy}
          onClick={() => moveToChapter(prevChapter)}
          aria-label="Mover al capítulo anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 pointer-coarse:size-[2.85rem]"
          disabled={!nextChapter || busy}
          onClick={() => moveToChapter(nextChapter)}
          aria-label="Mover al capítulo siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
        <ArcMenu
          grid={grid}
          current={scene.arc}
          busy={busy}
          onPick={(arc) =>
            onApply({ kind: "arc", chapterId: chapter.chapterId, index: scene.index, arc })
          }
        />
      </div>
    </div>
  );
}

function ArcMenu({
  grid,
  current,
  busy,
  onPick,
}: {
  grid: PlotGrid;
  current: string | null;
  busy: boolean;
  onPick: (arc: string | null) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 pointer-coarse:size-[2.85rem]"
          disabled={busy}
          aria-label="Cambiar el arco de la escena"
        >
          <Tag className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Arco narrativo
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {grid.arcs.map((arc) => (
          <DropdownMenuItem
            key={arc}
            onSelect={() => onPick(arc)}
            className={cn(arc === current && "font-medium")}
          >
            {arc}
          </DropdownMenuItem>
        ))}
        {current !== null && (
          <DropdownMenuItem onSelect={() => onPick(null)}>Sin arco</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <div className="p-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || !draft.trim()) return;
              onPick(draft.trim());
              setDraft("");
            }}
            placeholder="Arco nuevo"
            aria-label="Arco nuevo"
            className="h-9 text-sm"
            maxLength={60}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
