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
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { usePlotGrid, usePlotOperation } from "./writing.hooks";
import type { PlotChapter, PlotGrid, PlotScene } from "./writing.plot";

/**
 * Plot grid (KIN-141): las escenas de la obra como tarjetas en una rejilla de
 * capítulo × arco. Reordenar la estructura moviendo tarjetas en vez de cortando
 * y pegando texto.
 *
 * Mover una tarjeta **reescribe el texto** de los capítulos implicados. No hay un
 * orden persistido en paralelo que pueda divergir de lo escrito: las escenas se
 * siguen derivando del contenido, como desde W3.
 *
 * Se arrastra, pero también se mueve con botones. No es solo por accesibilidad:
 * un arrastre accidental aquí reescribe el manuscrito, así que la vía explícita
 * tiene que existir siempre y funcionar igual en un móvil.
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
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
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

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Las escenas salen del texto. Mover una tarjeta reescribe el capítulo —
            no hay un orden aparte que se pueda desincronizar.
          </p>
          {isPending && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-max border-separate border-spacing-2">
            <thead>
              <tr>
                <th className="w-28 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Arco
                </th>
                {data.chapters.map((chapter, i) => (
                  <th key={chapter.chapterId} className="min-w-56 text-left">
                    <Link
                      href={`/systems/${systemId}/pages/${chapter.chapterId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {chapter.title?.trim() || `Capítulo ${i + 1}`}
                    </Link>
                    <p className="text-xs font-normal text-muted-foreground">
                      {chapter.scenes.length === 1
                        ? "1 escena"
                        : `${chapter.scenes.length} escenas`}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((arc) => (
                <tr key={arc ?? SIN_ARCO}>
                  <th className="w-28 align-top text-left text-xs font-medium text-muted-foreground">
                    {arc ?? "Sin arco"}
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
          <div className="max-w-56 rounded-lg border bg-card p-2.5 text-xs shadow-lg">
            {sceneAt(data, dragging)?.preview || "Escena en blanco"}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <Layers className="mx-auto size-8 text-muted-foreground/40" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{hint}</p>
    </div>
  );
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
        "min-w-56 align-top rounded-lg border border-dashed p-1.5 transition-colors",
        isOver ? "border-primary bg-accent/50" : "border-border/50",
      )}
    >
      <div className="space-y-1.5">
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
          <p className="px-1 py-3 text-center text-[11px] text-muted-foreground/50">
            —
          </p>
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
        "group rounded-lg border bg-card p-2.5 text-xs transition-opacity",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Arrastrar la escena ${scene.index + 1} de ${chapter.title ?? "el capítulo"}`}
          className="min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing"
        >
          <span className="mb-1 block font-mono text-[10px] text-muted-foreground">
            Escena {scene.index + 1} · {scene.wordCount.toLocaleString("es")} palabras
          </span>
          <span className="line-clamp-4 text-muted-foreground">
            {scene.preview || "Escena en blanco"}
          </span>
        </button>
      </div>

      <div className="mt-2 flex items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          disabled={!prevChapter || busy}
          onClick={() => moveToChapter(prevChapter)}
          aria-label="Mover al capítulo anterior"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          disabled={!nextChapter || busy}
          onClick={() => moveToChapter(nextChapter)}
          aria-label="Mover al capítulo siguiente"
        >
          <ChevronRight className="size-3.5" />
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
          className="size-6"
          disabled={busy}
          aria-label="Cambiar el arco de la escena"
        >
          <Tag className="size-3.5" />
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
            placeholder="Arco nuevo…"
            className="h-7 text-xs"
            maxLength={60}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
