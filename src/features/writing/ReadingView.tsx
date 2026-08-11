"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Printer,
  ScrollText,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MEDIUM_CONFIG } from "@/shared/lib/mediums";
import { CompileMenu } from "./CompileMenu";
import type { Manuscript } from "./writing.manuscript";

/**
 * Modo lectura (KIN-138): la obra como la vería quien la lee, no quien la
 * escribe. Cambiar la presentación rompe la ceguera del autor sobre su propio
 * texto — es una técnica de revisión de verdad, no un adorno.
 *
 * La presentación la dicta `readingLayout` del MediumManifest: no hay nada nuevo
 * que decidir sobre qué es cada medium, solo cómo se enseña cuando ya no se está
 * escribiendo.
 *
 * El HTML se inyecta tal cual porque es el mismo contenido que el editor del
 * usuario produce y muestra: no hay contenido de terceros en el producto (toda
 * query filtra por `userId`), así que la superficie de riesgo no cambia respecto
 * al editor.
 */

type Mode = "paged" | "scroll";

export function ReadingView({
  manuscript,
  autoPrint = false,
}: {
  manuscript: Manuscript;
  /** Llega con `?print=1` desde "PDF (imprimir)" del menú de compilación. */
  autoPrint?: boolean;
}) {
  const medium = MEDIUM_CONFIG[manuscript.medium];
  const layout = medium.readingLayout;
  // Paginar un guion por píxeles sería mentir sobre dónde caen sus páginas: se
  // cuentan en líneas, no en columnas. Solo el libro se ofrece paginado.
  const canPage = layout === "book";

  const [mode, setMode] = useState<Mode>(canPage ? "paged" : "scroll");
  const [paper, setPaper] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const paged = canPage && mode === "paged";

  const syncEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  const turn = useCallback(
    (direction: 1 | -1) => {
      const el = scroller.current;
      if (!el) return;
      el.scrollBy({ left: direction * el.clientWidth });
    },
    [],
  );

  useEffect(() => {
    if (!paged) return;
    syncEdges();
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown") turn(1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") turn(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, turn, syncEdges]);

  const empty = manuscript.chapters.every(
    (c) => !c.content || c.content.trim().length === 0,
  );

  // El diálogo de impresión se abre una sola vez y tras un frame: si se llama
  // durante el montaje, Chrome fotografía la página a medio pintar.
  const printed = useRef(false);
  useEffect(() => {
    if (!autoPrint || empty || printed.current) return;
    printed.current = true;
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, [autoPrint, empty]);

  return (
    <div
      className="mx-auto w-full max-w-4xl"
      data-paper={paper ? "on" : undefined}
    >
      <div className="reading-no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{manuscript.title}</h1>
          <p className="text-xs text-muted-foreground">
            {medium.label} · {manuscript.chapters.length}{" "}
            {manuscript.chapters.length === 1
              ? medium.unit.noun
              : medium.unit.nounPlural}{" "}
            · {manuscript.totalWords.toLocaleString("es")} palabras
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <CompileMenu
            folderId={manuscript.folderId}
            systemId={manuscript.systemId}
            manuscript={manuscript}
          />
          {canPage && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMode((m) => (m === "paged" ? "scroll" : "paged"))}
            >
              {paged ? (
                <>
                  <ScrollText className="size-4" />
                  Continuo
                </>
              ) : (
                <>
                  <Columns2 className="size-4" />
                  Paginado
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-pressed={paper}
            aria-label="Fondo papel"
            onClick={() => setPaper((p) => !p)}
          >
            <Sun className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Imprimir o guardar como PDF"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
          </Button>
        </div>
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <BookOpen className="mx-auto size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm font-medium">Todavía no hay nada que leer</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Escribe algo en un {medium.unit.noun} y vuelve: leerse en otro formato
            enseña cosas que el editor esconde.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div
            ref={scroller}
            onScroll={paged ? syncEdges : undefined}
            data-layout={layout}
            className={cn("reading-surface", paged && "reading-paged")}
          >
            {manuscript.chapters.map((chapter) => (
              <section key={chapter.id} className="reading-chapter">
                <h2 className="reading-chapter-title mb-6 text-center text-base font-semibold uppercase tracking-widest text-muted-foreground">
                  {chapter.title?.trim() || "Sin título"}
                </h2>
                {chapter.content ? (
                  <div dangerouslySetInnerHTML={{ __html: chapter.content }} />
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    (en blanco)
                  </p>
                )}
              </section>
            ))}
          </div>

          {paged && (
            <div className="reading-no-print mt-4 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                disabled={atStart}
                onClick={() => turn(-1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Se pasa página con las flechas
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                disabled={atEnd}
                onClick={() => turn(1)}
                aria-label="Página siguiente"
              >
                <ChevronRight className="size-5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
