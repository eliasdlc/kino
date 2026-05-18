"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpdateStickyNote, useDeleteStickyNote } from "./sticky-notes.hooks";
import { STICKY_NOTE_COLORS, COLOR_PICKER_OPTIONS } from "./sticky-note-colors";
import type { StickyNoteItem } from "./sticky-notes.types";

interface StickyNoteCardProps {
  note: StickyNoteItem;
  context: { pageId?: string; folderId?: string };
}

export function StickyNoteCard({ note, context }: StickyNoteCardProps) {
  const { mutate: updateNote, isPending: isUpdating } = useUpdateStickyNote(context);
  const { mutate: deleteNote } = useDeleteStickyNote(context);

  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(note.title ?? "");
  const [content, setContent] = useState(note.content ?? "");
  const [color, setColor] = useState(note.color);

  const colors = STICKY_NOTE_COLORS[note.color] ?? STICKY_NOTE_COLORS.yellow!;

  function handleOpenEdit() {
    setTitle(note.title ?? "");
    setContent(note.content ?? "");
    setColor(note.color);
    setEditOpen(true);
  }

  function handleSave() {
    updateNote(
      { noteId: note.id, data: { title: title || null, content: content || null, color } },
      { onSuccess: () => setEditOpen(false) }
    );
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col gap-2 rounded-lg border p-3 cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          colors.bg,
          colors.border
        )}
        onClick={handleOpenEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOpenEdit(); }}
      >
        {note.title && (
          <p className={cn("text-xs font-semibold leading-tight line-clamp-2", colors.text)}>
            {note.title}
          </p>
        )}
        {note.content && (
          <p className={cn("text-xs leading-snug line-clamp-4", colors.text, "opacity-80")}>
            {note.content}
          </p>
        )}
        {!note.title && !note.content && (
          <p className={cn("text-xs italic opacity-50", colors.text)}>Empty note</p>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                className={cn(
                  "absolute top-1.5 right-1.5 size-5 rounded flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-black/10 dark:hover:bg-white/10"
                )}
                aria-label="Delete note"
              >
                <X className={cn("size-3", colors.text)} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete note</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit note</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <Input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
            <Textarea
              placeholder="Write something..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="resize-none min-h-[100px]"
              maxLength={500}
            />

            {/* Color picker */}
            <div className="flex flex-wrap gap-2">
              {COLOR_PICKER_OPTIONS.map((c) => {
                const cls = STICKY_NOTE_COLORS[c]!;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c as typeof color)}
                    aria-label={c}
                    className={cn(
                      "size-6 rounded-full border-2 transition-transform hover:scale-110",
                      cls.bg,
                      color === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                  />
                );
              })}
            </div>

            <Button onClick={handleSave} disabled={isUpdating}>
              {isUpdating && <Loader2 className="size-4 animate-spin mr-2" />}
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
