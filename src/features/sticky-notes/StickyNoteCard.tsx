"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, MoreHorizontal, PanelLeft, PanelRight, PinOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useUpdateStickyNote, useDeleteStickyNote } from "./sticky-notes.hooks";
import { STICKY_NOTE_COLORS, COLOR_PICKER_OPTIONS, paperStyle } from "./sticky-note-colors";
import type { StickyNoteItem } from "./sticky-notes.types";

interface StickyNoteCardProps {
  note: StickyNoteItem;
  context: { pageId?: string; folderId?: string };
}

function EditOverlay({
  note,
  context,
  onClose,
}: {
  note: StickyNoteItem;
  context: { pageId?: string; folderId?: string };
  onClose: () => void;
}) {
  const { mutate: updateNote, isPending } = useUpdateStickyNote(context);
  const [title, setTitle] = useState(note.title ?? "");
  const [content, setContent] = useState(note.content ?? "");
  const [color, setColor] = useState(note.color);
  const backdropRef = useRef<HTMLDivElement>(null);
  const colors = STICKY_NOTE_COLORS[color] ?? STICKY_NOTE_COLORS.yellow!;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    updateNote(
      { noteId: note.id, data: { title: title || null, content: content || null, color: color as never } },
      { onSuccess: onClose }
    );
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-[400px] flex flex-col items-center gap-4 px-4 sm:px-0 pb-4 sm:pb-0">
        {/* Square Post-it */}
        <div
          className="w-[90%] aspect-square rounded-lg p-6 flex flex-col gap-1.5"
          style={{ ...paperStyle(colors.hex), transform: "rotate(-1.5deg)", color: colors.textHex }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Título..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="bg-transparent outline-none text-lg font-semibold placeholder:opacity-30 w-full"
            style={{ color: colors.textHex }}
          />
          <textarea
            placeholder="Escribe aquí..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            className="bg-transparent outline-none resize-none flex-1 placeholder:opacity-30 w-full text-sm leading-relaxed"
            style={{ color: colors.textHex }}
          />
        </div>

        {/* Bottom panel */}
        <div className="w-full bg-white dark:bg-card rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
          <div>
            <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">Color</p>
            <div className="flex gap-2.5 flex-wrap">
              {COLOR_PICKER_OPTIONS.map((c) => {
                const cls = STICKY_NOTE_COLORS[c]!;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c as typeof color)}
                    aria-label={c}
                    className="size-8 rounded-full transition-all"
                    style={{
                      backgroundColor: cls.hex,
                      border: `3px solid ${color === c ? "#00000055" : "transparent"}`,
                      transform: color === c ? "scale(1.18)" : "scale(1)",
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StickyNoteCard({ note, context }: StickyNoteCardProps) {
  const { mutate: deleteNote } = useDeleteStickyNote(context);
  const { mutate: updateNote } = useUpdateStickyNote(context);
  const [editOpen, setEditOpen] = useState(false);
  const colors = STICKY_NOTE_COLORS[note.color] ?? STICKY_NOTE_COLORS.yellow!;

  function pinToSide(side: "left" | "right" | null) {
    updateNote({
      noteId: note.id,
      data: { positionSide: side, positionY: side ? 0.12 : null, positionX: side ? 0 : null },
    });
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="group relative flex flex-col gap-1 cursor-pointer rounded-lg p-3.5 w-full min-h-[90px]"
            style={{ ...paperStyle(colors.hex), color: colors.textHex }}
            onClick={() => setEditOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setEditOpen(true); }}
          >
            {note.title && (
              <p className="font-semibold text-sm leading-tight break-words" style={{ color: colors.textHex }}>
                {note.title}
              </p>
            )}
            {note.content && (
              <p
                className="text-sm leading-snug whitespace-pre-wrap break-words"
                style={{ color: colors.textHex, opacity: 0.88 }}
              >
                {note.content}
              </p>
            )}
            {!note.title && !note.content && (
              <p className="text-xs italic opacity-35" style={{ color: colors.textHex }}>Nota vacía</p>
            )}

            {/* Top-right controls */}
            <div
              className="absolute top-1.5 right-1.5 flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              {context.pageId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="size-5 rounded flex items-center justify-center hover:bg-black/15"
                      aria-label="Opciones de posición"
                    >
                      <MoreHorizontal className="size-3" style={{ color: colors.textHex }} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {note.positionSide !== "left" && (
                      <DropdownMenuItem className="gap-2 text-xs" onClick={() => pinToSide("left")}>
                        <PanelLeft className="size-3" /> Margen izquierdo
                      </DropdownMenuItem>
                    )}
                    {note.positionSide !== "right" && (
                      <DropdownMenuItem className="gap-2 text-xs" onClick={() => pinToSide("right")}>
                        <PanelRight className="size-3" /> Margen derecho
                      </DropdownMenuItem>
                    )}
                    {note.positionSide && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-xs" onClick={() => pinToSide(null)}>
                          <PinOff className="size-3" /> Quitar del margen
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                type="button"
                onClick={() => deleteNote(note.id)}
                className="size-5 rounded flex items-center justify-center hover:bg-black/15"
                aria-label="Eliminar nota"
              >
                <X className="size-3" style={{ color: colors.textHex }} />
              </button>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem className="gap-2" onSelect={() => setEditOpen(true)}>
            <Pencil className="size-3.5" /> Editar
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" className="gap-2" onSelect={() => deleteNote(note.id)}>
            <Trash2 className="size-3.5" /> Eliminar
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {editOpen && (
        <EditOverlay note={note} context={context} onClose={() => setEditOpen(false)} />
      )}
    </>
  );
}
