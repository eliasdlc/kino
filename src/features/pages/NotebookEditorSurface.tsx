"use client";

import { useRef, useState } from "react";
import { EditorProvider } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import { StickyNotesGrid } from "@/features/sticky-notes/StickyNotesGrid";
import { FloatingNotesLayer } from "@/features/sticky-notes/FloatingNotesLayer";
import { StickyNoteCreator } from "@/features/sticky-notes/StickyNoteCreator";
import { useStickyNotesByPage } from "@/features/sticky-notes/sticky-notes.hooks";
import type { PageDetail } from "./pages.types";

/**
 * The Tiptap editing surface, isolated so it can be loaded with `next/dynamic`
 * ({ ssr: false }) from the layout (KIN-73). All heavy editor extensions
 * (StarterKit, table, suggestion, list — and image in Sprint 3) live behind this
 * boundary, so they land in a deferred client chunk instead of the route's
 * initial JS. Client-only load also sidesteps Tiptap's SSR hydration warning.
 */
export default function NotebookEditorSurface({
  page,
  systemId,
}: {
  page: PageDetail;
  systemId: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const { data: allNotes = [] } = useStickyNotesByPage(page.id);
  const floatingNotes = allNotes.filter((n) => n.positionSide);
  const pageContext = { pageId: page.id };

  // Creador flotante abierto con click derecho: guarda el punto de pantalla y la
  // posición (columna-relativa) donde caerá la nota.
  const [creator, setCreator] = useState<
    | { screen: { x: number; y: number }; position: { positionX: number; positionY: number } }
    | null
  >(null);

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>) {
    // Las notas ya tienen su propio menú contextual; no interceptar sobre ellas.
    if ((e.target as HTMLElement).closest("[data-sticky-note]")) return;
    // Dejar pasar el menú nativo cuando hay texto seleccionado (copiar, etc.).
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;

    const container = contentRef.current;
    const column = columnRef.current;
    if (!container || !column) return;

    e.preventDefault();
    const cr = container.getBoundingClientRect();
    const colr = column.getBoundingClientRect();
    const positionX = (e.clientX - colr.left) / colr.width;
    const positionY = (e.clientY - cr.top) / container.offsetHeight;
    setCreator({ screen: { x: e.clientX, y: e.clientY }, position: { positionX, positionY } });
  }

  return (
    <EditorProvider key={page.id} initialContent={page.content ?? ""}>
      <div className="flex-1 overflow-y-auto">
        <div
          ref={contentRef}
          className="relative min-h-full"
          onContextMenu={handleContextMenu}
        >
          <div
            ref={columnRef}
            className="max-w-3xl mx-auto px-4 py-6 md:px-6 md:py-8 space-y-8"
          >
            <StickyNotesGrid pageId={page.id} />
            <NotebookEditor page={page} systemId={systemId} pageId={page.id} />
          </div>
          <FloatingNotesLayer
            notes={floatingNotes}
            context={pageContext}
            containerRef={contentRef}
            columnRef={columnRef}
          />
        </div>
      </div>

      {creator && (
        <StickyNoteCreator
          context={pageContext}
          anchorPoint={creator.screen}
          fixedPosition={creator.position}
          onClose={() => setCreator(null)}
        />
      )}
    </EditorProvider>
  );
}
