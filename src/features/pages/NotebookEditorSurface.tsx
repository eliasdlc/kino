"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { EditorProvider, useSharedEditor } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import { WriterStatusBar, type WriterObra } from "./WriterStatusBar";
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
/**
 * Typewriter scroll (PLAN-11 §7): mantiene el cursor a ~45% de la altura del
 * contenedor de scroll mientras escribes en modo focus. Inerte si !enabled.
 */
function TypewriterScroll({
  enabled,
  scrollRef,
}: {
  enabled: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const editor = useSharedEditor();

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!enabled || !editor || !scroller) return;

    const center = () => {
      const { from } = editor.state.selection;
      const caret = editor.view.coordsAtPos(from);
      const box = scroller.getBoundingClientRect();
      const target = box.top + box.height * 0.45;
      scroller.scrollBy({ top: caret.top - target, behavior: "smooth" });
    };

    editor.on("selectionUpdate", center);
    editor.on("update", center);
    return () => {
      editor.off("selectionUpdate", center);
      editor.off("update", center);
    };
  }, [enabled, editor, scrollRef]);

  return null;
}

export default function NotebookEditorSurface({
  page,
  systemId,
  writer = false,
  obra = null,
  focusMode = false,
  onToggleFocus,
}: {
  page: PageDetail;
  systemId: string;
  /** Arquetipo Writing: activa el "writer feel" (serif, medida de lectura, status bar). */
  writer?: boolean;
  /** Datos de la obra para el progreso en la status bar (null si no aplica). */
  obra?: WriterObra | null;
  /** Modo focus activo: atenúa lo demás y activa typewriter scroll. */
  focusMode?: boolean;
  onToggleFocus?: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { data: allNotes = [] } = useStickyNotesByPage(page.id);
  const floatingNotes = allNotes.filter((n) => n.positionSide);
  const pageContext = { pageId: page.id };
  const [paper, setPaper] = useState(false);

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
    <EditorProvider
      key={page.id}
      initialContent={page.content ?? ""}
      codex={writer ? { systemId } : null}
    >
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          ref={scrollRef}
          className={cn("flex-1 overflow-y-auto", writer && focusMode && "writer-focus")}
        >
          <div
            ref={contentRef}
            className={cn("relative min-h-full", writer && focusMode && "py-[30vh]")}
            onContextMenu={handleContextMenu}
          >
            <div
              ref={columnRef}
              data-paper={writer && paper ? "on" : undefined}
              className={cn(
                "mx-auto px-4 py-6 md:px-6 md:py-8 space-y-8",
                writer ? "max-w-[46rem] md:my-6 md:px-10" : "max-w-3xl"
              )}
            >
              <StickyNotesGrid pageId={page.id} />
              <NotebookEditor page={page} systemId={systemId} pageId={page.id} writer={writer} />
            </div>
            <FloatingNotesLayer
              notes={floatingNotes}
              context={pageContext}
              containerRef={contentRef}
              columnRef={columnRef}
            />
          </div>
        </div>

        {writer && <TypewriterScroll enabled={focusMode} scrollRef={scrollRef} />}

        {writer && (
          <WriterStatusBar
            obra={obra}
            paper={paper}
            onTogglePaper={() => setPaper((p) => !p)}
            focusMode={focusMode}
            onToggleFocus={onToggleFocus}
          />
        )}
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
