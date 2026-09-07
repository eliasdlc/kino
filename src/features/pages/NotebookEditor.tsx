"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdatePage } from "./pages.hooks";
import { useSharedEditor } from "./EditorContext";
import { TableMenus } from "./TableMenus";
import { CodexChips } from "@/features/entities/CodexChips";
import { CodexSelectionActions } from "./CodexBubbleMenu";
import { EntityFicheSheet } from "@/features/entities/EntityFicheSheet";
import { StickyNoteCreator } from "@/features/sticky-notes/StickyNoteCreator";
import type { PageDetailTransport } from "./pages.types";

interface NotebookEditorProps {
  page: PageDetailTransport;
  systemId: string;
  pageId?: string;
  /** Arquetipo Writing: activa la tipografía serif de lectura (PLAN-11 §7). */
  writer?: boolean;
}

export function NotebookEditor({ page, systemId, pageId, writer = false }: NotebookEditorProps) {
  const editor = useSharedEditor();
  const { mutate: updatePage } = useUpdatePage(page.id, systemId);
  const [title, setTitle] = useState(page.title ?? "");
  const [stickyCreator, setStickyCreator] = useState<{
    text: string | null;
    anchorId: string | null;
    screen: { x: number; y: number };
  } | null>(null);
  const [mentionEntityId, setMentionEntityId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<{ title?: string; content?: string } | null>(null);

  // Click en una mención del codex → abre su ficha (referencia a un click sin
  // salir del texto, PLAN-11 §8.3). Solo en editores de escritura.
  function handleEditorClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!writer) return;
    const mention = (e.target as HTMLElement).closest<HTMLElement>(".codex-mention");
    const id = mention?.getAttribute("data-entity-id");
    if (id) {
      e.preventDefault();
      setMentionEntityId(id);
    }
  }

  const scheduleSave = useCallback(
    (patch: { title?: string; content?: string }) => {
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        const pending = pendingPatch.current;
        pendingPatch.current = null;
        if (pending) updatePage(pending);
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

  // Lo pendiente se guarda al desmontar, y sólo al desmontar: un efecto que
  // dependiera de `updatePage` correría su limpieza en cada render y volvería
  // a mandar el mismo parche en bucle. Por eso la función se lee por ref.
  const updatePageRef = useRef(updatePage);
  useEffect(() => {
    updatePageRef.current = updatePage;
  }, [updatePage]);
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      const pending = pendingPatch.current;
      pendingPatch.current = null;
      if (pending) updatePageRef.current(pending);
    };
  }, []);

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

    // Abrir el popover junto al final de la selección.
    const coords = editor.view.coordsAtPos(to);
    setStickyCreator({
      text: text || null,
      anchorId: anchorId ?? null,
      screen: { x: coords.right, y: coords.bottom },
    });
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
        {/* El codex a un toque mientras escribes. En escritorio no: ahí el rail
            del panel derecho ya lo cubre y esta fila sería una segunda forma de
            hacer lo mismo. */}
        {writer && (
          <div className="md:hidden">
            <CodexChips pageId={page.id} systemId={systemId} />
          </div>
        )}
        <div className={cn("tiptap-editor flex-1 relative", writer && "tiptap-writer")}>
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
                {writer && <CodexSelectionActions editor={editor} systemId={systemId} />}
              </div>
            </BubbleMenu>
          )}
          {editor && <TableMenus editor={editor} />}
          <div onClickCapture={handleEditorClick}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {writer && (
        <EntityFicheSheet
          entityId={mentionEntityId}
          systemId={systemId}
          open={mentionEntityId !== null}
          onOpenChange={(o) => !o && setMentionEntityId(null)}
        />
      )}

      {stickyCreator !== null && (
        <StickyNoteCreator
          context={{ pageId: resolvedPageId }}
          anchorPoint={stickyCreator.screen}
          textAnchor={stickyCreator.text ?? undefined}
          anchorId={stickyCreator.anchorId ?? undefined}
          onClose={() => setStickyCreator(null)}
        />
      )}
    </>
  );
}
