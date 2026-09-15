"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { scrollBehavior } from "@/shared/utils/motion";
import { EditorProvider, useSharedEditor } from "./EditorContext";
import { NotebookEditor } from "./NotebookEditor";
import { WriterStatusBar, type WriterObra } from "./WriterStatusBar";
import { DocumentRailLayer } from "./DocumentRail";
import { deriveOutline, type OutlineItem } from "./mediums/outline";
import type { MediumManifest } from "@/shared/lib/mediums";
import { StickyNotesGrid } from "@/features/sticky-notes/StickyNotesGrid";
import { FloatingNotesLayer } from "@/features/sticky-notes/FloatingNotesLayer";
import { AnchorBridge } from "@/features/sticky-notes/AnchorBridge";
import { AnchorHighlightProvider, AnchorPaint } from "@/features/sticky-notes/AnchorHighlight";
import { StickyNoteCreator } from "@/features/sticky-notes/StickyNoteCreator";
import { SelectionToolbar } from "@/features/sticky-notes/SelectionToolbar";
import { useStickyNotesByPage } from "@/features/sticky-notes/sticky-notes.hooks";
import { useNotebookMetrics } from "@/features/sticky-notes/use-notebook-metrics";
import type { PageDetailTransport } from "./pages.types";

/**
 * The Tiptap editing surface, isolated so it can be loaded with `next/dynamic`
 * ({ ssr: false }) from the layout (KIN-73). All heavy editor extensions
 * (StarterKit, table, suggestion, list: and image in Sprint 3) live behind this
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
      scroller.scrollBy({ top: caret.top - target, behavior: scrollBehavior() });
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

/**
 * La puerta de la nota adhesiva. Vive dentro del provider porque necesita el
 * editor compartido, y sólo sabe una cosa: qué hay seleccionado ahora mismo.
 *
 * Hasta ahora las notas nacían con click derecho sobre un hueco, un gesto que
 * nadie descubre solo y que además no las ancla a nada. Aquí la palabra aparece
 * la primera vez que marcas texto, y no vuelve.
 */
function SelectionGate({ onAnnotate }: { onAnnotate: (texto: string, punto: { x: number; y: number }) => void }) {
  const editor = useSharedEditor();
  const [seleccion, setSeleccion] = useState("");

  useEffect(() => {
    if (!editor) return;
    const mirar = () => {
      const { from, to, empty } = editor.state.selection;
      setSeleccion(empty ? "" : editor.state.doc.textBetween(from, to, " "));
    };
    editor.on("selectionUpdate", mirar);
    return () => {
      editor.off("selectionUpdate", mirar);
    };
  }, [editor]);

  function anotar(texto: string) {
    if (!editor) return;
    // El punto de anclaje es el final de lo marcado: el popover se abre donde
    // acabas de soltar, no en una esquina.
    const { to } = editor.state.selection;
    const caret = editor.view.coordsAtPos(to);
    onAnnotate(texto, { x: caret.left, y: caret.bottom });
  }

  return (
    <div className="px-4 md:px-6">
      <SelectionToolbar selection={seleccion} onAnnotate={anotar} />
    </div>
  );
}

/** El sitio del documento que hay a una altura, y a qué altura está ese sitio. */
interface SitioDelTexto {
  pos: number;
  /** Y de pantalla donde empieza la línea de ese sitio. */
  top: number;
}

/**
 * Traduce un punto de pantalla al sitio del documento que hay debajo.
 *
 * Vive dentro del provider porque necesita el editor, y publica la función en
 * un ref porque quien la usa (el manejador del click derecho) se define fuera.
 * Es el mismo patrón que `OutlineBridge` con `jumpRef`.
 */
function PosBridge({
  posRef,
}: {
  posRef: React.RefObject<((punto: { x: number; y: number }) => SitioDelTexto | null) | null>;
}) {
  const editor = useSharedEditor();

  useEffect(() => {
    const ref = posRef;
    ref.current = ({ x, y }) => {
      if (!editor) return null;
      const encontrado = editor.view.posAtCoords({ left: x, top: y });
      if (!encontrado) return null;
      try {
        return { pos: encontrado.pos, top: editor.view.coordsAtPos(encontrado.pos).top };
      } catch {
        return null;
      }
    };
    return () => {
      ref.current = null;
    };
  }, [editor, posRef]);

  return null;
}

/**
 * Puente entre el editor y lo que navega el documento: el carril de títulos de
 * esta misma superficie y el navegador del manuscrito, que vive fuera de este
 * árbol (en el panel lateral del layout). Publica hacia arriba el índice derivado
 * y deja el salto en un ref: así el layout no necesita montar Tiptap y el editor
 * sigue cargándose bajo demanda (KIN-73).
 */
function OutlineBridge({
  onOutline,
  jumpRef,
}: {
  onOutline: (items: OutlineItem[]) => void;
  jumpRef: React.RefObject<((pos: number) => void) | null>;
}) {
  const editor = useSharedEditor();

  useEffect(() => {
    if (!editor) return;
    const recompute = () => onOutline(deriveOutline(editor.state.doc));
    recompute();
    editor.on("update", recompute);
    return () => {
      editor.off("update", recompute);
      onOutline([]);
    };
  }, [editor, onOutline]);

  useEffect(() => {
    if (!editor) return;
    const ref = jumpRef;
    ref.current = (pos) => {
      // ProseMirror devuelve a veces un nodo de texto en vez del bloque.
      const dom = editor.view.nodeDOM(pos);
      const el = dom instanceof HTMLElement ? dom : (dom as ChildNode | null)?.parentElement;
      el?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    };
    return () => {
      ref.current = null;
    };
  }, [editor, jumpRef]);

  return null;
}

export default function NotebookEditorSurface({
  page,
  systemId,
  writer = false,
  obra = null,
  medium = null,
  focusMode = false,
  onToggleFocus,
  onOutline,
  jumpRef,
  title,
  onTitleChange,
}: {
  page: PageDetailTransport;
  systemId: string;
  /** El título vive en el layout: lo leen las migas y todo lo que lo pinta. */
  title: string;
  onTitleChange: (title: string) => void;
  /** Arquetipo Writing: activa el "writer feel" (serif, medida de lectura, status bar). */
  writer?: boolean;
  /** Datos de la obra para el progreso en la status bar (null si no aplica). */
  obra?: WriterObra | null;
  /** Medium de la obra (W3): nodos, slash menu y teclado propios del formato. */
  medium?: MediumManifest | null;
  /** Modo focus activo: atenúa lo demás y activa typewriter scroll. */
  focusMode?: boolean;
  onToggleFocus?: () => void;
  /** Publica el índice derivado del capítulo hacia el navegador del layout. */
  onOutline?: (items: OutlineItem[]) => void;
  jumpRef?: React.RefObject<((pos: number) => void) | null>;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // El índice sube al layout (que pinta el panel) y se queda también aquí, que
  // es donde vive el carril. Un solo cálculo, dos consumidores.
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const publishOutline = useCallback(
    (items: OutlineItem[]) => {
      setOutline(items);
      onOutline?.(items);
    },
    [onOutline],
  );
  // El salto lo produce el editor una vez. Si el layout trae su ref, es el
  // mismo objeto: el panel y el carril saltan con la misma función.
  const ownJumpRef = useRef<((pos: number) => void) | null>(null);
  const jump = jumpRef ?? ownJumpRef;
  const { data: allNotes = [] } = useStickyNotesByPage(page.id);
  // La geometría se mide una vez y aquí se decide quién dibuja cada nota: la
  // capa flotante si el margen da para ella, la rejilla de abajo si no. Antes
  // la decisión vivía en dos clases de CSS y cada nota se montaba dos veces.
  // La columna nunca se mueve por culpa de una nota, y la nota va donde la
  // pusiste: cabe donde cabe. Una nota con posición la dibuja la capa, y la
  // rejilla dibuja el resto, así que ninguna se monta dos veces.
  const { metrics } = useNotebookMetrics(contentRef, columnRef);
  const floatingNotes = allNotes.filter((n) => n.positionSide);
  const floatingIds = floatingNotes.map((n) => n.id);
  const pageContext = { pageId: page.id };
  const [paper, setPaper] = useState(false);

  // Creador flotante abierto con click derecho: guarda el punto de pantalla y la
  // posición (columna-relativa) donde caerá la nota.
  const [creator, setCreator] = useState<
    | {
        screen: { x: number; y: number };
        position?: { positionX: number; positionY: number };
        textAnchor?: string;
        positionalAnchor?: { anchorId: string; pos: number; offsetY: number };
      }
    | null
  >(null);
  const posAt = useRef<((punto: { x: number; y: number }) => SitioDelTexto | null) | null>(null);

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
    // La nota nace donde pulsaste, y de paso apuntada al párrafo que hay a esa
    // altura con cuánto por encima o por debajo de él la pusiste. El párrafo es
    // lo que la hace bajar con el texto cuando escribes arriba; el desfase, lo
    // que la deja exactamente donde la pegaste. El sitio se busca en el centro
    // de la columna, que es donde hay texto.
    const sitio = posAt.current?.({ x: colr.left + colr.width / 2, y: e.clientY }) ?? null;
    setCreator({
      screen: { x: e.clientX, y: e.clientY },
      position: { positionX, positionY },
      positionalAnchor:
        sitio === null
          ? undefined
          : { anchorId: crypto.randomUUID(), pos: sitio.pos, offsetY: e.clientY - sitio.top },
    });
  }

  return (
    <EditorProvider
      key={page.id}
      initialContent={page.content ?? ""}
      codex={writer ? { systemId } : null}
      medium={writer ? medium : null}
    >
      <AnchorHighlightProvider>
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <SelectionGate
            onAnnotate={(textAnchor, screen) => setCreator({ screen, textAnchor })}
          />
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
                <NotebookEditor page={page} systemId={systemId} pageId={page.id} writer={writer} title={title} onTitleChange={onTitleChange} />
                {/* Las notas van después del texto: la página escribe primero. */}
                <StickyNotesGrid pageId={page.id} floatingIds={floatingIds} />
              </div>
              <FloatingNotesLayer
                notes={floatingNotes}
                context={pageContext}
                containerRef={contentRef}
                metrics={metrics}
              />
            </div>
          </div>

          {/* El carril es de los documentos normales. El manuscrito navega por su
              panel, con sus escenas y sus páginas, y no cambia. */}
          {!writer && (
            <DocumentRailLayer
              items={outline}
              scrollRef={scrollRef}
              onJump={(pos) => jump.current?.(pos)}
            />
          )}

          {writer && <TypewriterScroll enabled={focusMode} scrollRef={scrollRef} />}

          {/* El índice ya no es del manuscrito: todo documento lo deriva, porque
              el carril de títulos de un apunte come de aquí igual que el panel
              del capítulo. En un documento sin mediums de escritura lo que sale
              son sus encabezados y nada más. */}
          <OutlineBridge onOutline={publishOutline} jumpRef={jump} />
          <PosBridge posRef={posAt} />
          {/* Una nota que vuelve de la papelera vuelve con su resaltado. */}
          <AnchorBridge notes={allNotes} />
          {/* Y cada frase anotada, con el color de papel de la nota que la comenta. */}
          <AnchorPaint notes={allNotes} />

          {writer && (
            <WriterStatusBar
              obra={obra}
              systemId={systemId}
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
            textAnchor={creator.textAnchor}
            positionalAnchor={creator.positionalAnchor}
            onClose={() => setCreator(null)}
          />
        )}
      </AnchorHighlightProvider>
    </EditorProvider>
  );
}
