"use client";

import { useState } from "react";
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
import {
  useStickyNotesByPage,
  useStickyNotesByFolder,
  useStackStickyNotes,
} from "./sticky-notes.hooks";
import { StickyNoteCard } from "./StickyNoteCard";
import { StickyNoteStack } from "./StickyNoteStack";
import { StickyNoteCreator } from "./StickyNoteCreator";
import { StackNoteSheet } from "./StackNoteSheet";
import type { StickyNoteItem } from "./sticky-notes.types";

type Props =
  | { pageId: string; folderId?: never }
  | { folderId: string; pageId?: never };

/** O una página o una carpeta, nunca las dos: el creador lo exige discriminado. */
type NoteContext = Props;

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
        isDragging && "opacity-40",
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
 * Las columnas de notas. Las dos ramas por viewport pintan esto mismo: lo único
 * que cambia es si la nota suelta lleva sensores de arrastre o la operación de
 * apilar.
 */
function NotesColumns({
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
    <div className="[columns:2] sm:[columns:3] lg:[columns:4] [column-gap:0.75rem]">
      {groups.map((group) => (
        <div key={group[0]!.stackId ?? group[0]!.id} className="break-inside-avoid mb-3">
          {group.length === 1 ? renderNote(group[0]!) : <StickyNoteStack notes={group} context={context} />}
        </div>
      ))}
      {marginNotes.map((note) => (
        <div key={note.id} className="break-inside-avoid mb-3 md:hidden">
          {renderNote(note)}
        </div>
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
  const isMobile = useIsMobile();

  // Non-margin notes always visible; margin notes shown only on mobile (md:hidden)
  const notes = allNotes.filter((n) => !n.positionSide);
  const marginNotes = allNotes.filter((n) => !!n.positionSide);
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
    if (!over || active.id === over.id) return;

    const draggedNote = allNotes.find((n) => n.id === active.id);
    const targetNote = allNotes.find((n) => n.id === over.id);
    if (!draggedNote || !targetNote) return;

    stackNotes({ draggedId: draggedNote.id, targetId: targetNote.id });
  }

  const hasNotes = groups.length > 0 || marginNotes.length > 0;

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {/* La rama por viewport va antes del contexto de arrastre, como en las
            otras cuatro superficies: en el teléfono no se monta ningún sensor y
            apilar es una operación con nombre en el menú de la nota. */}
        {!isLoading && hasNotes && isMobile && (
          <NotesColumns
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
            <NotesColumns
              groups={groups}
              marginNotes={marginNotes}
              context={context}
              renderNote={(note) => (
                <DraggableNote note={note} context={context} activeId={activeId} />
              )}
            />
            <DragOverlay>
              {activeNote && (
                <div className="opacity-90 rotate-3 scale-105">
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
