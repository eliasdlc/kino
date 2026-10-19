"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Ellipsis, PanelRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { ChapterStatusToggle } from "@/features/writing/ChapterStatusToggle";
import { WritingSessionButton } from "@/features/writing/WritingSessionButton";
import type { OutlineItem } from "./mediums/outline";
import type { BreadcrumbItem } from "@/components/PageBreadcrumb";
import type { PageDetailTransport, PageListItemTransport } from "./pages.types";
import type { WriterObra } from "./WriterStatusBar";
import type { MediumManifest } from "@/shared/lib/mediums";
import { unidadDe } from "@/features/writing/unidad";
import {
  BOTON_MAS,
  nombreDelBotonMas,
  FILA_DEL_TITULO,
  LETRA_DEL_TITULO,
  PrimeraPinturaContext,
  CUERPO_DEL_ESCRITOR,
  RESERVA_CODEX,
  contenedorConScroll,
  usePrimeraPintura,
  type ScrollGuardado,
} from "./primera-pintura";

/**
 * Lo que se pinta antes de que llegue el editor: el título y el texto ya
 * saneados por el servidor, con las mismas clases que tendrá el editor. Leer
 * no espera a Tiptap; el cursor y la barra llegan con su chunk. Para que el
 * texto no se mueva al llegar, la primera pintura lleva lo que el editor pone
 * encima del cuerpo: la fila del título con Más a 2.85rem y, en un capítulo
 * con fichas del codex, el alto de su fila. Y lo que se bajó leyendo se
 * conserva: el editor arranca en el mismo scroll.
 */
export function PrimeraPinturaDelEditor() {
  const pintura = usePrimeraPintura();
  const columna = useRef<HTMLDivElement>(null);
  const guardar = pintura?.guardarScroll;

  // Al irse, apunta qué se desplazaba y cuánto: el editor que llega arranca ahí.
  useLayoutEffect(() => {
    const nodo = columna.current;
    return () => {
      const contenedor = contenedorConScroll(nodo);
      if (contenedor) guardar?.({ contenedor, top: contenedor.scrollTop });
    };
  }, [guardar]);

  return (
    <div aria-busy className="relative flex flex-1 flex-col overflow-hidden">
      <div ref={columna} data-slot="primera-pintura" className="flex-1 overflow-y-auto">
        <div
          className={cn(
            "mx-auto space-y-8 py-6 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] md:px-6 md:py-8",
            pintura?.writer ? "max-w-[46rem] md:my-6 md:px-10" : "max-w-3xl",
          )}
        >
          <div className="flex flex-col gap-4">
            <div className={FILA_DEL_TITULO}>
              <p
                className={cn(
                  "block min-w-0 flex-1",
                  LETRA_DEL_TITULO,
                  pintura?.titulo ? "text-foreground" : "text-muted-foreground/60",
                )}
              >
                {pintura?.titulo || "Sin título"}
              </p>
              <button
                type="button"
                onClick={pintura?.onOpenPanel}
                aria-label={nombreDelBotonMas(pintura?.etiquetaMas ?? null)}
                className={BOTON_MAS}
              >
                {pintura?.etiquetaMas && <span>{pintura.etiquetaMas}</span>}
                <Ellipsis aria-hidden className="size-5" />
              </button>
            </div>
            {pintura?.writer && (
              <div className="md:hidden">
                {pintura.fichasDelCodex > 0 && <div aria-hidden className={RESERVA_CODEX} />}
              </div>
            )}
            <div className={cn("tiptap-editor relative flex-1", pintura?.writer && CUERPO_DEL_ESCRITOR)}>
              {pintura?.cuerpo}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// La superficie de Tiptap (StarterKit, tablas, sugerencias, listas, imagen) se
// carga en el cliente y bajo demanda, fuera del JavaScript inicial de la ruta
// (KIN-73). Mientras llega, la primera pintura enseña el texto del servidor.
const NotebookEditorSurface = dynamic(() => import("./NotebookEditorSurface"), {
  ssr: false,
  loading: PrimeraPinturaDelEditor,
});

// El panel (índice, codex, referencias, versiones, etiquetas, tareas, exportar)
// es un solo chunk aparte fuera del JavaScript inicial: nadie lo necesita para
// empezar a escribir. Se precarga en reposo y se monta la primera vez que se abre.
const cargarPanel = () => import("./EditorPanel");
const EditorPanel = dynamic(cargarPanel, { ssr: false });

interface NotebookEditorLayoutProps {
  page: PageDetailTransport;
  systemId: string;
  breadcrumbItems: BreadcrumbItem[];
  /** The root notebook: null if current page IS the root */
  parentNotebook: Pick<PageListItemTransport, "id" | "title"> | null;
  /** Sub-pages of the root notebook (pre-fetched server-side) */
  initialSubPages: PageListItemTransport[];
  /** Arquetipo Writing: activa el "writer feel" del editor (PLAN-11 §7). */
  writer?: boolean;
  /** Obra a la que pertenece el capítulo: alimenta el progreso de la status bar. */
  obra?: WriterObra | null;
  /** Metadata de la obra: de ahí sale la mesa de referencias (W4). */
  obraMetadata?: Record<string, unknown> | null;
  /** Medium de la obra (W3): estructura del editor, vocabulario y export. */
  medium?: MediumManifest | null;
  /**
   * El cuerpo saneado y renderizado en el servidor, con la clase del editor.
   * Llega como nodo para que el saneo (y su librería) se quede en el servidor.
   */
  firstPaint?: React.ReactNode;
  /** Cuántas fichas del codex nombra el capítulo: reserva su fila en la primera pintura. */
  fichasDelCodex?: number;
}

export function NotebookEditorLayout({
  page,
  systemId,
  breadcrumbItems,
  parentNotebook,
  initialSubPages,
  writer = false,
  obra = null,
  obraMetadata = null,
  medium = null,
  firstPaint = null,
  fichasDelCodex = 0,
}: NotebookEditorLayoutProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  // El chunk del panel se pide al abrirlo y se queda montado: cerrar y volver a
  // abrir no lo vuelve a descargar ni pierde su animación de salida.
  const [panelMounted, setPanelMounted] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  // Índice del documento: lo calcula el editor (que vive en un chunk aparte) y lo
  // publica aquí; el salto se queda en un ref para no re-renderizar por él. Lo
  // lee el navegador del manuscrito, y bajo md también la lista del panel.
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const jumpRef = useRef<((pos: number) => void) | null>(null);
  // El scroll de la primera pintura, para que el editor arranque donde quedó.
  const scrollDeLaPrimeraPintura = useRef<ScrollGuardado | null>(null);

  // El título se escribe en el editor pero lo pintan las migas, el nombre de la
  // sesión de escritura, el interruptor de capítulo y el del archivo exportado.
  // Vive aquí para que los cinco cambien en la misma tecla.
  const [title, setTitle] = useState(page.title ?? "");
  const livePage = { ...page, title: title || null };
  const liveBreadcrumb = breadcrumbItems.map((item, index) =>
    index === breadcrumbItems.length - 1 ? { ...item, label: title || "Sin título" } : item,
  );

  function guardarScroll(scroll: ScrollGuardado) {
    scrollDeLaPrimeraPintura.current = scroll;
  }
  function tomarScroll() {
    const scroll = scrollDeLaPrimeraPintura.current;
    scrollDeLaPrimeraPintura.current = null;
    return scroll;
  }

  function openPanel() {
    setPanelMounted(true);
    setPanelOpen(true);
  }

  // El chunk del panel se pide en reposo, después de la primera pintura: el
  // primer toque en la puerta del panel abre la hoja al instante y no espera a
  // la red. Sin requestIdleCallback (Safari), un segundo después.
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(() => void cargarPanel(), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => void cargarPanel(), 1000);
    return () => window.clearTimeout(id);
  }, []);

  // Esc sale del modo focus (PLAN-11 §7).
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* El nombre de la pantalla para quien la lee con lector: el título se
          escribe en un campo, y un campo no es un encabezado. */}
      <h1 className="sr-only">{title || "Sin título"}</h1>

      {/* La barra de arriba es de escritorio. En el teléfono la cabecera corrida
          ya lleva «‹ padre», y lo demás (sesión, estado del capítulo, panel)
          vive en Más, en el título y en la barra del pulgar. En modo enfoque
          desaparece para dejar sólo el texto. */}
      <div
        data-slot="editor-bar"
        className={cn(
          "sticky top-0 z-(--z-raised) hidden shrink-0 items-center gap-2 border-b border-border bg-background px-3 py-1.5 md:flex",
          focusMode && "md:hidden",
        )}
      >
        <div className="min-w-0 flex-1">
          <PageBreadcrumb items={liveBreadcrumb} />
        </div>
        {writer && <WritingSessionButton pageId={page.id} pageTitle={livePage.title} systemId={systemId} />}
        {writer && (
          <ChapterStatusToggle
            pageId={page.id}
            systemId={systemId}
            title={livePage.title}
            initialCompletedAt={page.completedAt}
            unit={medium?.unit}
          />
        )}
        <button
          type="button"
          onClick={openPanel}
          aria-label="Abrir panel"
          aria-expanded={panelOpen}
          className="press flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[color,background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-secondary hover:text-foreground pointer-coarse:size-[2.85rem]"
        >
          <PanelRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <PrimeraPinturaContext.Provider
          value={{
            titulo: title,
            cuerpo: firstPaint,
            writer,
            etiquetaMas: writer ? unidadDe(medium?.unit).Noun : null,
            fichasDelCodex,
            onOpenPanel: openPanel,
            guardarScroll: guardarScroll,
            tomarScroll: tomarScroll,
          }}
        >
          <NotebookEditorSurface
            page={page}
            title={title}
            onTitleChange={setTitle}
            systemId={systemId}
            writer={writer}
            obra={obra}
            medium={medium}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode((f) => !f)}
            onOutline={setOutline}
            jumpRef={jumpRef}
            onOpenPanel={openPanel}
          />
        </PrimeraPinturaContext.Provider>
      </div>

      {panelMounted && (
        <EditorPanel
          open={panelOpen}
          onOpenChange={setPanelOpen}
          page={livePage}
          systemId={systemId}
          rootPageId={parentNotebook?.id ?? page.id}
          initialSubPages={initialSubPages}
          writer={writer}
          obra={obra}
          obraMetadata={obraMetadata}
          medium={medium}
          outline={outline}
          onJump={(pos) => jumpRef.current?.(pos)}
        />
      )}
    </div>
  );
}
