"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdatePage } from "./pages.hooks";
import { useSharedEditor } from "./EditorContext";
import { TableMenus } from "./TableMenus";
import { StickyNoteCreator } from "@/features/sticky-notes/StickyNoteCreator";
import type { PageDetail } from "./pages.types";

interface NotebookEditorProps {
  page: PageDetail;
  systemId: string;
  pageId?: string;
}

export function NotebookEditor({ page, systemId, pageId }: NotebookEditorProps) {
  const editor = useSharedEditor();
  const { mutate: updatePage } = useUpdatePage(page.id, systemId);
  const [title, setTitle] = useState(page.title ?? "");
  const [stickyCreator, setStickyCreator] = useState<{
    text: string | null;
    anchorId: string | null;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<{ title?: string; content?: string } | null>(null);

  const scheduleSave = useCallback(
    (patch: { title?: string; content?: string }) => {
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updatePage(pendingPatch.current!);
        pendingPatch.current = null;
      }, 1500);
    },
    [updatePage]
  );

  // Subscribe to editor updates for autosave
  useEffect(() => {
    if (!editor) return;
    const handler = () => scheduleSave({ content: editor.getHTML() });
    editor.on("update", handler);
    return () => { editor.off("update", handler); };
  }, [editor, scheduleSave]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (pendingPatch.current) updatePage(pendingPatch.current);
      }
    };
  }, [updatePage]);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    scheduleSave({ title: e.target.value || undefined });
  }

  function handleCreateSticky() {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const text = empty ? "" : editor.state.doc.textBetween(from, to, " ");

    let anchorId: string | undefined;
    if (!empty) {
      anchorId = crypto.randomUUID();
      editor.chain().setMark("stickyAnchor", { anchorId }).run();
    }

    setStickyCreator({ text: text || null, anchorId: anchorId ?? null });
  }

  const resolvedPageId = pageId ?? page.id;

  return (
    <>
      <div className="flex flex-col gap-4 h-full">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Sin título"
          className="w-full bg-transparent text-3xl font-bold placeholder:text-muted-foreground/40 focus:outline-none border-none p-0"
          maxLength={500}
        />
        <div className="tiptap-editor flex-1 relative">
          {editor && (
            <BubbleMenu editor={editor}>
              <div className="flex items-center gap-1 bg-popover border border-border rounded-lg px-1.5 py-1 shadow-lg">
                <button
                  type="button"
                  onClick={handleCreateSticky}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                    "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  title="Crear sticky note del texto seleccionado"
                >
                  <StickyNote className="size-3" />
                  Sticky
                </button>
              </div>
            </BubbleMenu>
          )}
          {editor && <TableMenus editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>

      {stickyCreator !== null && (
        <StickyNoteCreator
          context={{ pageId: resolvedPageId }}
          textAnchor={stickyCreator.text ?? undefined}
          anchorId={stickyCreator.anchorId ?? undefined}
          onClose={() => setStickyCreator(null)}
        />
      )}
    </>
  );
}
