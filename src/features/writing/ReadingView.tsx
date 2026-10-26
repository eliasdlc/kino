"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Scroll } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import { SanitizedHtml } from "@/shared/components/SanitizedHtml";
import { MEDIUM_CONFIG } from "@/shared/lib/mediums";
import { CompileMenu } from "./CompileMenu";
import type { Manuscript } from "./writing.manuscript";

/**
 * Modo lectura (KIN-138): la obra como la vería quien la lee, no quien la
 * escribe. Cambiar la presentación rompe la ceguera del autor sobre su propio
 * texto: es una técnica de revisión de verdad, no un adorno.
 *
 * La presentación la dicta `readingLayout` del MediumManifest: no hay nada nuevo
 * que decidir sobre qué es cada medium, solo cómo se enseña cuando ya no se está
 * escribiendo.
 *
 * El capítulo se pinta por `SanitizedHtml`: el contenido de una página ya no lo
 * escribe sólo el editor del usuario, el MCP también, y eso puede traer HTML que
 * el editor nunca habría producido.
 *
 * Diario: el título de la obra en display como título de pantalla, la meta
 * debajo separada por comas, y las acciones de 48 px en dos grupos que se
 * parten juntos: compilar con el segmento Paginado o Continuo en tinta, y
 * «Papel cálido» con «Imprimir». En el teléfono son dos renglones alineados; en
 * el escritorio, uno. Cada capítulo abre con su numeral en Bricolage y su título
 * en Literata, como en un libro.
 */

/**
 * El cuerpo saneado de un capítulo. Memorizado por su HTML: cambiar a papel o
 * a Continuo vuelve a pintar la cabecera, no a sanear la obra entera.
 */
const CuerpoDelCapitulo = memo(function CuerpoDelCapitulo({ html }: { html: string }) {
  return <SanitizedHtml html={html} />;
});

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

  const unidades =
    manuscript.chapters.length === 1 ? medium.unit.noun : medium.unit.nounPlural;
  const unidadMayuscula = medium.unit.noun.charAt(0).toUpperCase() + medium.unit.noun.slice(1);

  return (
    <div className="mx-auto w-full max-w-4xl" data-paper={paper ? "on" : undefined}>
      <header className="reading-no-print mb-8 space-y-4">
        <div className="space-y-1">
          <h1 className="font-display text-[1.41rem] leading-tight font-bold tracking-[-0.02em] text-foreground">
            {manuscript.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {medium.label}, {manuscript.chapters.length} {unidades},{" "}
            {manuscript.totalWords.toLocaleString("es")} palabras
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CompileMenu
              folderId={manuscript.folderId}
              systemId={manuscript.systemId}
              manuscript={manuscript}
              onPrint={() => window.print()}
            />
            {canPage && (
              <Segmented<Mode>
                aria-label="Cómo se lee"
                value={mode}
                onValueChange={setMode}
                options={[
                  { value: "paged", label: "Paginado" },
                  { value: "scroll", label: "Continuo" },
                ]}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Un interruptor con forma: borde cuando está apagado, tinta llena
                cuando está puesto. El nombre dice qué cambia. */}
            <Button
              variant="outline"
              aria-pressed={paper}
              onClick={() => setPaper((p) => !p)}
              className="aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground/90"
            >
              <Scroll aria-hidden />
              Papel cálido
            </Button>
            <Button variant="ghost" onClick={() => window.print()} aria-label="Imprimir o guardar como PDF">
              <Printer aria-hidden />
              Imprimir
            </Button>
          </div>
        </div>
      </header>

      {empty ? (
        <EmptyState
          title="Todavía no hay nada que leer"
          description="Escribe algo y vuelve: leerse en otro formato enseña cosas que el editor esconde."
        />
      ) : (
        <div className="relative">
          <div
            ref={scroller}
            onScroll={paged ? syncEdges : undefined}
            data-layout={layout}
            // Justificado con partición de palabras: sin ríos en una columna estrecha.
            className={cn("reading-surface hyphens-auto", paged && "reading-paged")}
          >
            {manuscript.chapters.map((chapter, index) => (
              <section key={chapter.id} className="reading-chapter" aria-labelledby={`capitulo-${chapter.id}`}>
                <header className="reading-chapter-title mb-8 text-center">
                  {/* Un span y no un párrafo: la prosa de lectura justifica y sangra
                      cada párrafo, y el numeral va centrado. */}
                  <span aria-hidden className="block font-display text-xl font-bold text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <h2 id={`capitulo-${chapter.id}`} className="mt-1! mb-0! font-serif text-xl leading-snug font-semibold text-foreground">
                    <span className="sr-only">{unidadMayuscula} {index + 1}: </span>
                    {chapter.title?.trim() || "Sin título"}
                  </h2>
                </header>
                {chapter.content ? (
                  <CuerpoDelCapitulo html={chapter.content} />
                ) : (
                  <p className="text-center font-voice text-base italic text-muted-foreground">En blanco todavía.</p>
                )}
              </section>
            ))}
          </div>

          {paged && (
            <div className="reading-no-print mt-4 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                disabled={atStart}
                onClick={() => turn(-1)}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-5" />
              </Button>
              <span className="text-sm text-muted-foreground">
                <span className="pointer-coarse:hidden">También con las flechas del teclado</span>
                <span className="hidden pointer-coarse:inline">También deslizando la página</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
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
