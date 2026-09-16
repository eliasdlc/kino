"use client";

import { useState } from "react";
import type { RefObject } from "react";
import { Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSharedEditor } from "@/features/pages/EditorContext";
import {
  useStickyNotesByPage,
  useStickyNotesByFolder,
  useStackStickyNotes,
  useUpdateStickyNote,
} from "./sticky-notes.hooks";
import { StickyNoteCard } from "./StickyNoteCard";
import { StickyNoteStack } from "./StickyNoteStack";
import { StickyNoteCreator } from "./StickyNoteCreator";
import { StackNoteSheet } from "./StackNoteSheet";
import { dropNote } from "./drop-note";
import { clampToCanvas, NOTE_W, type NotebookMetrics } from "./sticky-position";
import type { StickyNoteItem } from "./sticky-notes.types";

/**
 * El cuaderno sobre el que una nota de la cuadrícula puede caer. Lo trae la
 * página, que es la única superficie con texto debajo: en una carpeta la
 * cuadrícula es el único sitio donde vive una nota.
 */
export interface NotebookCanvas {
  containerRef: RefObject<HTMLDivElement | null>;
  metrics: NotebookMetrics;
}

type Props = (
  | { pageId: string; folderId?: never; canvas?: NotebookCanvas }
  | { folderId: string; pageId?: never; canvas?: never }
) & {
  /**
   * Las notas que la capa flotante ya está dibujando. La rejilla pinta todo lo
   * demás, así que una nota se monta una vez y no dos: cuando el margen no da
   * para flotar, esta lista llega vacía y las notas caen aquí enteras.
   */
  floatingIds?: string[];
};

/** O una página o una carpeta, nunca las dos: el creador lo exige discriminado. */
type NoteContext = { pageId: string; folderId?: never } | { folderId: string; pageId?: never };

/** Groups notes by stackId, returning ordered groups (ungrouped notes = group of 1) */
function groupNotes(notes: StickyNoteItem[]): StickyNoteItem[][] {
  const stacks = new Map<string, StickyNoteItem[]>();
  const singles: StickyNoteItem[] = [];

  for (const note of notes) {
    if (note.stackId) {
      const bucket = stacks.get(note.stackId) ?? [];
      bucket.push(note);
      stacks.set(note.stackId, bucket);
    } else {
      singles.push(note);
    }
  }

  const result: StickyNoteItem[][] = [];
  for (const note of singles) result.push([note]);
  for (const group of stacks.values()) result.push(group);
  return result;
}

/** Subtle deterministic tilt so the board feels like real sticky notes. */
function tiltOf(noteId: string): number {
  const hash = noteId.charCodeAt(0) + noteId.charCodeAt(noteId.length - 1);
  return (hash % 5) - 2; // -2..2
}

function DraggableNote({
  note,
  context,
  activeId,
}: {
  note: StickyNoteItem;
  context: NoteContext;
  activeId: string | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: note.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: note.id });

  const setRef = (el: HTMLElement | null) => {
    setNodeRef(el);
    setDropRef(el);
  };

  return (
    <div
      ref={setRef}
      {...listeners}
      {...attributes}
      style={{ transform: isDragging ? undefined : `rotate(${tiltOf(note.id)}deg)` }}
      className={cn(
        "touch-none transition-transform",
        // Levantada, en la cuadrícula queda su hueco: la nota va en el puntero.
        isDragging && "opacity-25",
        isOver && activeId !== note.id && "ring-2 ring-primary/60 rounded-lg scale-105"
      )}
    >
      <StickyNoteCard note={note} context={context} />
    </div>
  );
}

/** La misma nota sin sensores, para el teléfono. Apilar es una operación. */
function TappableNote({
  note,
  context,
  onStack,
}: {
  note: StickyNoteItem;
  context: NoteContext;
  onStack: () => void;
}) {
  return (
    <div style={{ transform: `rotate(${tiltOf(note.id)}deg)` }}>
      <StickyNoteCard note={note} context={context} onStack={onStack} />
    </div>
  );
}

/**
 * Las notas, una al lado de otra. Las dos ramas por viewport pintan esto
 * mismo: lo único que cambia es si la nota suelta lleva sensores de arrastre o
 * la operación de apilar. Son cuadrados de lado fijo, así que fluyen en filas
 * y no en columnas: el mismo papel que flota sobre el texto.
 */
function NotesRow({
  groups,
  marginNotes,
  context,
  renderNote,
}: {
  groups: StickyNoteItem[][];
  marginNotes: StickyNoteItem[];
  context: NoteContext;
  renderNote: (note: StickyNoteItem) => React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-3 py-1">
      {groups.map((group) => (
        <div key={group[0]!.stackId ?? group[0]!.id}>
          {group.length === 1 ? renderNote(group[0]!) : <StickyNoteStack notes={group} context={context} />}
        </div>
      ))}
      {marginNotes.map((note) => (
        <div key={note.id}>{renderNote(note)}</div>
      ))}
    </div>
  );
}

export function StickyNotesGrid(props: Props) {
  const isPage = "pageId" in props && !!props.pageId;
  const context: NoteContext = isPage
    ? { pageId: props.pageId as string }
    : { folderId: props.folderId as string };

  const pageQuery = useStickyNotesByPage(isPage ? (props.pageId as string) : "");
  const folderQuery = useStickyNotesByFolder(!isPage ? (props.folderId as string) : "");
  const { data: allNotes = [], isLoading } = isPage ? pageQuery : folderQuery;
  const { mutate: stackNotes } = useStackStickyNotes(context);
  const { mutate: updateNote } = useUpdateStickyNote(context);
  const editor = useSharedEditor();
  const isMobile = useIsMobile();
  const canvas = isPage ? props.canvas : undefined;

  // Lo que la capa flotante no dibuja, lo dibuja la rejilla.
  const flotando = new Set(props.floatingIds ?? []);
  const enRejilla = allNotes.filter((n) => !flotando.has(n.id));
  const notes = enRejilla.filter((n) => !n.positionSide);
  const marginNotes = enRejilla.filter((n) => !!n.positionSide);
  const groups = groupNotes(notes);

  const [creatorAnchor, setCreatorAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stacking, setStacking] = useState<StickyNoteItem | null>(null);
  const activeNote = allNotes.find((n) => n.id === activeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    const draggedNote = allNotes.find((n) => n.id === active.id);
    if (!draggedNote) return;

    // Encima de otra nota, se apila.
    if (over && over.id !== active.id) {
      const targetNote = allNotes.find((n) => n.id === over.id);
      if (targetNote) stackNotes({ draggedId: draggedNote.id, targetId: targetNote.id });
      return;
    }

    // En cualquier otro sitio del cuaderno, se pega ahí: la nota sale de la
    // cuadrícula y pasa a flotar donde la soltaste, sin pedir un margen.
    const container = canvas?.containerRef.current;
    const rect = active.rect.current.translated;
    if (!canvas || !container || !rect) return;
    const cr = container.getBoundingClientRect();
    const leftPx = clampToCanvas(rect.left - cr.left, canvas.metrics);
    const topPx = Math.min(Math.max(0, rect.top - cr.top), Math.max(0, canvas.metrics.containerH - NOTE_W));
    updateNote({
      noteId: draggedNote.id,
      data: dropNote({ note: draggedNote, editor, container, metrics: canvas.metrics, leftPx, topPx }),
    });
  }

  const hasNotes = groups.length > 0 || marginNotes.length > 0;

  // En una página la sección existe sólo mientras haya una nota en la
  // cuadrícula: sin notas no hay nada que enseñar, y las notas nacen del texto
  // (una selección, un click derecho), no de aquí. La carpeta no tiene texto,
  // así que ahí la sección se queda siempre con su botón de añadir.
  if (isPage && !hasNotes) return null;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <StickyNote className="size-4" />
            Notas
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground"
            onClick={(e) => setCreatorAnchor({ x: e.clientX, y: e.clientY })}
          >
            <Plus className="size-3" />
            Añadir
          </Button>
        </div>

        {isLoading && (
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="size-44 rounded-lg" />
            ))}
          </div>
        )}

        {/* La rama por viewport va antes del contexto de arrastre, como en las
            otras cuatro superficies: en el teléfono no se monta ningún sensor y
            apilar es una operación con nombre en el menú de la nota. */}
        {!isLoading && hasNotes && isMobile && (
          <NotesRow
            groups={groups}
            marginNotes={marginNotes}
            context={context}
            renderNote={(note) => (
              <TappableNote note={note} context={context} onStack={() => setStacking(note)} />
            )}
          />
        )}

        {!isLoading && hasNotes && !isMobile && (
          <DndContext
            sensors={sensors}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <NotesRow
              groups={groups}
              marginNotes={marginNotes}
              context={context}
              renderNote={(note) => (
                <DraggableNote note={note} context={context} activeId={activeId} />
              )}
            />
            <DragOverlay dropAnimation={null}>
              {activeNote && (
                <div className="scale-[1.04] drop-shadow-[0_14px_18px_rgba(0,0,0,0.28)]">
                  <StickyNoteCard note={activeNote} context={context} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {!isLoading && !hasNotes && (
          <p className="text-xs text-muted-foreground">Aún no hay notas.</p>
        )}
      </div>

      <StackNoteSheet
        open={stacking !== null}
        onOpenChange={(next) => !next && setStacking(null)}
        note={stacking}
        notes={allNotes}
        onStack={(targetId) => {
          if (stacking) stackNotes({ draggedId: stacking.id, targetId });
          setStacking(null);
        }}
      />

      {creatorAnchor && (
        <StickyNoteCreator
          context={context}
          anchorPoint={creatorAnchor}
          onClose={() => setCreatorAnchor(null)}
        />
      )}
    </>
  );
}
