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
import {
  useStickyNotesByPage,
  useStickyNotesByFolder,
  useStackStickyNotes,
} from "./sticky-notes.hooks";
import { StickyNoteCard } from "./StickyNoteCard";
import { StickyNoteStack } from "./StickyNoteStack";
import { StickyNoteCreator } from "./StickyNoteCreator";
import type { StickyNoteItem } from "./sticky-notes.types";

type Props =
  | { pageId: string; folderId?: never }
  | { folderId: string; pageId?: never };

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

function DraggableNote({
  note,
  context,
  activeId,
}: {
  note: StickyNoteItem;
  context: { pageId?: string; folderId?: string };
  activeId: string | null;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: note.id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: note.id });

  const setRef = (el: HTMLElement | null) => {
    setNodeRef(el);
    setDropRef(el);
  };

  // Subtle deterministic tilt so the board feels like real sticky notes.
  const hash = note.id.charCodeAt(0) + note.id.charCodeAt(note.id.length - 1);
  const tilt = (hash % 5) - 2; // -2..2

  return (
    <div
      ref={setRef}
      {...listeners}
      {...attributes}
      style={{ transform: isDragging ? undefined : `rotate(${tilt}deg)` }}
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

export function StickyNotesGrid(props: Props) {
  const isPage = "pageId" in props && !!props.pageId;
  const context = isPage
    ? { pageId: props.pageId as string }
    : { folderId: props.folderId as string };

  const pageQuery = useStickyNotesByPage(isPage ? (props.pageId as string) : "");
  const folderQuery = useStickyNotesByFolder(!isPage ? (props.folderId as string) : "");
  const { data: allNotes = [], isLoading } = isPage ? pageQuery : folderQuery;
  const { mutate: stackNotes } = useStackStickyNotes(context);

  // Non-margin notes always visible; margin notes shown only on mobile (md:hidden)
  const notes = allNotes.filter((n) => !n.positionSide);
  const marginNotes = allNotes.filter((n) => !!n.positionSide);
  const groups = groupNotes(notes);

  const [creatorAnchor, setCreatorAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
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

        {!isLoading && (groups.length > 0 || marginNotes.length > 0) && (
          <DndContext
            sensors={sensors}
            onDragStart={(e) => setActiveId(String(e.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="[columns:2] sm:[columns:3] lg:[columns:4] [column-gap:0.75rem]">
              {groups.map((group) => (
                <div key={group[0]!.stackId ?? group[0]!.id} className="break-inside-avoid mb-3">
                  {group.length === 1 ? (
                    <DraggableNote
                      note={group[0]!}
                      context={context}
                      activeId={activeId}
                    />
                  ) : (
                    <StickyNoteStack notes={group} context={context} />
                  )}
                </div>
              ))}
              {marginNotes.map((note) => (
                <div key={note.id} className="break-inside-avoid mb-3 md:hidden">
                  <DraggableNote note={note} context={context} activeId={activeId} />
                </div>
              ))}
            </div>
            <DragOverlay>
              {activeNote && (
                <div className="opacity-90 rotate-3 scale-105">
                  <StickyNoteCard note={activeNote} context={context} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {!isLoading && groups.length === 0 && marginNotes.length === 0 && (
          <p className="text-xs text-muted-foreground">Aún no hay notas.</p>
        )}
      </div>

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
