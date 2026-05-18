"use client";

import { useState } from "react";
import { Plus, StickyNote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useStickyNotesByPage,
  useStickyNotesByFolder,
  useCreateStickyNoteForPage,
  useCreateStickyNoteForFolder,
} from "./sticky-notes.hooks";
import { StickyNoteCard } from "./StickyNoteCard";
import { STICKY_NOTE_COLORS, COLOR_PICKER_OPTIONS } from "./sticky-note-colors";

type Props =
  | { pageId: string; folderId?: never }
  | { folderId: string; pageId?: never };

export function StickyNotesGrid(props: Props) {
  const isPage = "pageId" in props && !!props.pageId;
  const context = isPage
    ? { pageId: props.pageId }
    : { folderId: props.folderId };

  const pageQuery = useStickyNotesByPage(isPage ? props.pageId! : "");
  const folderQuery = useStickyNotesByFolder(!isPage ? props.folderId! : "");
  const { data: notes = [], isLoading } = isPage ? pageQuery : folderQuery;

  const createForPage = useCreateStickyNoteForPage(isPage ? props.pageId! : "");
  const createForFolder = useCreateStickyNoteForFolder(!isPage ? props.folderId! : "");
  const { mutate: createNote, isPending } = isPage ? createForPage : createForFolder;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string>("yellow");

  function handleCreate() {
    createNote(
      { title: title || undefined, content: content || undefined, color: color as never },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setTitle("");
          setContent("");
          setColor("yellow");
        },
      }
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <StickyNote className="size-4" />
          Sticky notes
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-3" />
          Add
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && notes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {notes.map((note) => (
            <StickyNoteCard key={note.id} note={note} context={context} />
          ))}
        </div>
      )}

      {!isLoading && notes.length === 0 && (
        <p className="text-xs text-muted-foreground">No sticky notes yet.</p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New sticky note</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-1">
            <Input
              autoFocus
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
                    onClick={() => setColor(c)}
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

            <Button onClick={handleCreate} disabled={isPending || (!title && !content)}>
              {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              {isPending ? "Adding..." : "Add note"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
