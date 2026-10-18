"use client";

import { memo, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { X, Layers, LayoutGrid, Lightbulb, MoreHorizontal, PanelLeft, PanelRight, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { RowActions } from "@/features/notebooks/RowActions";
import { useSharedEditor } from "@/features/pages/EditorContext";
import { useUpdateStickyNote, useDeleteStickyNote } from "./sticky-notes.hooks";
import { removeAnchorMark, isAnnotationAnchor } from "./anchor-utils";
import { useAnchorHighlight } from "./AnchorHighlight";
import { STICKY_NOTE_COLORS, COLOR_PICKER_OPTIONS, paperStyle } from "./sticky-note-colors";
import { GUTTER_LEFT_X, GUTTER_RIGHT_X } from "./sticky-position";
import type { StickyNoteItem } from "./sticky-notes.types";

interface StickyNoteCardProps {
  note: StickyNoteItem;
  context: { pageId?: string; folderId?: string };
  /**
   * Abre la hoja de apilar. Es el equivalente con nombre de soltar una nota
   * encima de otra, y existe donde el arrastre no llega: el teléfono.
   */
  onStack?: () => void;
}

type Lado = "abajo" | "arriba";

/** El dedo: los controles crecen a 2.85rem y el teclado tapa media pantalla. */
function esDedo(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

/**
 * Por dónde sale la bandeja de colores. Por abajo, salvo que ahí no quepa dentro
 * del contenedor de las notas (`data-notes-bounds`) y arriba quede más sitio:
 * una nota pegada al final del cuaderno abre la bandeja hacia el texto en vez de
 * colgarla fuera. La nota no se mueve; lo que cambia es el lado de la bandeja.
 */
function ladoDeLaBandeja(nota: HTMLElement | null, bandeja: HTMLElement | null): Lado {
  const limite = nota?.closest("[data-notes-bounds]");
  if (!nota || !bandeja || !limite) return "abajo";
  const n = nota.getBoundingClientRect();
  const l = limite.getBoundingClientRect();
  const sitioAbajo = l.bottom - n.bottom;
  const sitioArriba = n.top - l.top;
  return sitioAbajo < bandeja.offsetHeight && sitioArriba > sitioAbajo ? "arriba" : "abajo";
}

/** Cómo se nombra la nota al confirmar: su título, o sus primeras palabras. */
function nombreDeNota(note: Pick<StickyNoteItem, "title" | "content">): string {
  const titulo = note.title?.trim();
  if (titulo) return titulo;
  const palabras = note.content?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (palabras.length === 0) return "Nota vacía";
  return palabras.length > 6 ? `${palabras.slice(0, 6).join(" ")}…` : palabras.join(" ");
}

/**
 * La nota es un cuadrado de lado fijo, flote sobre el texto o esté en la
 * cuadrícula: el mismo papel en los dos sitios, y por eso arrastrarla de uno al
 * otro no la cambia de forma. Lo que no cabe se recorta y la nota avisa.
 *
 * Se edita sobre el propio papel: pulsarla cambia el texto por sus dos campos
 * en el mismo sitio, y la bandeja de colores sale por detrás. Se guarda al
 * pulsar fuera, con Escape o con Ctrl+Enter; el color se aplica al elegirlo.
 *
 * Va en `memo` porque la capa flotante la vuelve a pintar en cada frame de un
 * arrastre: con la nota y el contexto estables, el arrastre no la toca.
 */
export const StickyNoteCard = memo(function StickyNoteCard({ note, context, onStack }: StickyNoteCardProps) {
  const { mutate: removeNote } = useDeleteStickyNote(context);
  const { mutate: updateNote } = useUpdateStickyNote(context);
  const editor = useSharedEditor();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const [recortada, setRecortada] = useState(false);
  const [editando, setEditando] = useState(false);
  const [lado, setLado] = useState<Lado>("abajo");
  const [saltoDeLado, setSaltoDeLado] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const colors = STICKY_NOTE_COLORS[note.color] ?? STICKY_NOTE_COLORS.yellow!;
  const { lit, light } = useAnchorHighlight();
  const isMobile = useIsMobile();

  // La nota es media pareja sólo si su ancla anota una frase. La de posición no
  // marca ningún texto, así que no hay nada al otro lado que encender.
  const anota =
    !!note.anchorId && !!editor && isAnnotationAnchor(editor.state.doc, note.anchorId);
  const encendida = anota && lit === note.anchorId;

  function empezarAEditar() {
    if (editando) return;
    const nuevoLado = ladoDeLaBandeja(wrapperRef.current, trayRef.current);
    if (nuevoLado !== lado) {
      // El cambio de lado se pinta escondido y sin transición, y se fuerza el
      // estilo antes de abrir: si no, la bandeja viajaría a la vista desde el
      // otro lado del papel en vez de salir de detrás de él.
      flushSync(() => {
        setLado(nuevoLado);
        setSaltoDeLado(true);
      });
      trayRef.current?.getBoundingClientRect();
      setSaltoDeLado(false);
    }
    setTitle(note.title ?? "");
    setContent(note.content ?? "");
    setEditando(true);
  }

  /** Cierra la edición y guarda lo que cambió. Un texto vacío borra el campo. */
  function terminar() {
    setEditando(false);
    const nextTitle = title.trim() || null;
    const nextContent = content.trim() || null;
    if (nextTitle === (note.title ?? null) && nextContent === (note.content ?? null)) return;
    updateNote({ noteId: note.id, data: { title: nextTitle, content: nextContent } });
  }
  // La última versión de `terminar`, legible desde los listeners del documento.
  const terminarRef = useRef(terminar);
  useEffect(() => {
    terminarRef.current = terminar;
  });

  // Pulsar fuera de la nota o Escape la cierra guardando. Van en captura para
  // que un click que abre otra cosa (otra nota, el texto) también cierre ésta.
  useEffect(() => {
    if (!editando) return;
    function fuera(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) terminarRef.current();
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") terminarRef.current();
    }
    document.addEventListener("pointerdown", fuera, true);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera, true);
      window.removeEventListener("keydown", tecla);
    };
  }, [editando]);

  // El cursor entra al final del texto, que es donde se sigue escribiendo. Con
  // ratón, sin desplazar: una nota que asoma por un borde no arrastra el
  // cuaderno con ella. Con el dedo, al revés: el teclado sube después del foco
  // y encoge la pantalla, y el campo tiene que quedar por encima de él.
  useEffect(() => {
    if (!editando) return;
    const el = contentRef.current;
    if (!el) return;
    const dedo = esDedo();
    el.focus({ preventScroll: !dedo });
    el.setSelectionRange(el.value.length, el.value.length);
    const viewport = window.visualViewport;
    if (!dedo || !viewport) return;
    const aLaVista = () => el.scrollIntoView?.({ block: "nearest" });
    viewport.addEventListener("resize", aLaVista);
    return () => viewport.removeEventListener("resize", aLaVista);
  }, [editando]);

  // Con la nota abierta, su frase se queda encendida. Es lo único que da la
  // pareja exacta sin puntero, y en el teléfono no hay puntero: ahí abrir la
  // nota es el gesto que dice cuál de las frases comenta.
  useEffect(() => {
    if (!anota || !editando) return;
    light(note.anchorId);
    return () => light(null);
  }, [anota, editando, light, note.anchorId]);

  // Si el texto no cabe en el cuadrado. Se mide en vez de contar caracteres:
  // lo que cabe depende de la letra del sistema, que el usuario cambia.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const medir = () => setRecortada(el.scrollHeight > el.clientHeight + 1);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [note.title, note.content, note.isEureka, editando]);

  /**
   * Borrar la nota le quita también su marca al texto. Una marca sin nota no
   * anota nada: lo que dejaba era decoración suelta sobre una frase que ya
   * nadie comentaba. El texto se queda; lo que se va es el span. Por eso se
   * confirma antes, como cada borrado de las filas de este paquete.
   */
  function deleteNote(id: string) {
    setConfirmarBorrado(false);
    removeNote(id, {
      onSuccess: () => {
        if (note.anchorId && editor) removeAnchorMark(editor, note.anchorId);
      },
    });
  }

  /** Breakthrough: la idea que desbloquea la historia entra al diario (§9). */
  function toggleEureka() {
    updateNote({ noteId: note.id, data: { isEureka: !note.isEureka } });
  }

  function pinToSide(side: "left" | "right" | null) {
    updateNote({
      noteId: note.id,
      data: side
        ? {
            positionSide: side,
            positionY: note.positionY ?? 0.12,
            positionX: side === "left" ? GUTTER_LEFT_X : GUTTER_RIGHT_X,
          }
        : { positionSide: null, positionY: null, positionX: null },
    });
  }

  /** Los campos no arrastran la nota: ahí el puntero selecciona texto. */
  const sinArrastre = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation() };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div ref={wrapperRef} className="relative size-44">
            {/* La bandeja de colores vive detrás del papel y sale por abajo al
                editar. Está siempre montada para que el deslizamiento sea una
                transición y no un montaje; el papel es opaco y la tapa. */}
            <div
              ref={trayRef}
              data-no-drag
              data-lado={lado}
              inert={!editando}
              className={cn(
                "absolute inset-x-1.5 z-0 grid grid-cols-6 justify-items-center gap-1 border border-border bg-card px-2 shadow-(--shadow)",
                // Con el dedo cada color mide 2.85rem, y once no caben en 11rem sin
                // partirse en filas desiguales colgando bajo la nota: van en una
                // sola fila que se desliza de lado, con el sexto a medio asomar.
                "pointer-coarse:inset-x-0 pointer-coarse:flex pointer-coarse:snap-x pointer-coarse:snap-mandatory pointer-coarse:overflow-x-auto pointer-coarse:overscroll-x-contain pointer-coarse:gap-0 pointer-coarse:px-1 [scrollbar-width:none]",
                lado === "abajo" ? "top-full -mt-2 rounded-b-xl pb-2 pt-4" : "bottom-full -mb-2 rounded-t-xl pb-4 pt-2",
                saltoDeLado ? "transition-none" : "transition-transform duration-(--dur-hoja)",
                // Entra con pluma y se recoge con tinta, como las hojas.
                editando
                  ? "translate-y-0 ease-(--ease-pluma)"
                  : cn("ease-(--ease-tinta)", lado === "abajo" ? "-translate-y-full" : "translate-y-full")
              )}
              {...sinArrastre}
            >
              {COLOR_PICKER_OPTIONS.map((c) => {
                const cls = STICKY_NOTE_COLORS[c]!;
                const elegido = note.color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateNote({ noteId: note.id, data: { color: c as typeof note.color } })}
                    aria-label={cls.label}
                    aria-pressed={elegido}
                    className="flex size-5 items-center justify-center rounded-full focus-ring pointer-coarse:size-[2.85rem] pointer-coarse:shrink-0 pointer-coarse:snap-start"
                  >
                    <span
                      aria-hidden
                      className="size-5 rounded-full transition-transform duration-(--dur-toque) ease-(--ease-pluma) pointer-coarse:size-7"
                      style={{
                        backgroundColor: cls.hex,
                        border: `2px solid ${elegido ? "var(--foreground)" : "transparent"}`,
                        transform: elegido ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* El papel no es un botón: dentro lleva sus controles de esquina, y
                un control dentro de otro no se puede alcanzar ni nombrar. Lo que
                abre la edición es un botón propio que ocupa el papel entero, y
                los controles de la esquina van a su lado, no dentro. */}
            <div
              data-sticky-note
              data-lit={encendida ? "" : undefined}
              className={cn(
                "group relative z-10 flex size-44 flex-col gap-1 overflow-hidden rounded-[0.3rem] p-3.5",
                editando ? "cursor-text" : "cursor-pointer"
              )}
              style={{
                ...paperStyle(colors.hex, encendida ? { ink: colors.textHex } : undefined),
                color: colors.textHex,
              }}
              onMouseEnter={() => anota && light(note.anchorId)}
              onMouseLeave={() => anota && !editando && light(null)}
            >
              {editando ? (
                <div data-no-drag className="flex min-h-0 flex-1 select-text flex-col gap-1" {...sinArrastre}>
                  {/* El título comparte fila con el control de esquina: con el
                      dedo mide lo mismo de alto y deja su ancho libre, así que
                      el cuerpo empieza ya por debajo del botón. */}
                  <input
                    type="text"
                    placeholder="Título..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        contentRef.current?.focus();
                      }
                    }}
                    maxLength={200}
                    className={cn(
                      "w-full bg-transparent text-sm font-semibold leading-tight outline-none placeholder:opacity-30 pointer-coarse:min-h-8 pointer-coarse:pr-8",
                      isMobile && "min-h-8 pr-8"
                    )}
                    style={{ color: colors.textHex }}
                  />
                  <textarea
                    ref={contentRef}
                    placeholder="Escribe aquí..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) terminar();
                    }}
                    maxLength={500}
                    className="min-h-0 w-full flex-1 resize-none bg-transparent text-sm leading-snug outline-none placeholder:opacity-30"
                    style={{ color: colors.textHex }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={empezarAEditar}
                  className="-m-3.5 flex min-h-0 flex-1 cursor-pointer flex-col gap-1 rounded-[0.3rem] p-3.5 text-left outline-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-(--ring)"
                >
                  <span className="sr-only">Editar nota:</span>{" "}
                  {/* Un button sólo admite contenido de frase: los párrafos van
                      como `span` en bloque. */}
                  <span ref={bodyRef} className="block min-h-0 flex-1 space-y-1 overflow-hidden">
                    {/* El sitio del control de esquina de 48 px. Es un hueco
                        flotante y no un margen del título: el texto lo rodea, sea
                        título o cuerpo, y no pierde ancho por debajo del botón. */}
                    <span
                      aria-hidden
                      data-reserva-esquina
                      className={cn("float-right ml-1 size-8", isMobile ? "block" : "hidden pointer-coarse:block")}
                    />
                    {note.title && (
                      <span className="block font-semibold text-sm leading-tight break-words" style={{ color: colors.textHex }}>
                        {note.title}
                      </span>
                    )}
                    {note.content && (
                      <span
                        className="block text-sm leading-snug whitespace-pre-wrap break-words"
                        style={{ color: colors.textHex, opacity: 0.88 }}
                      >
                        {note.content}
                      </span>
                    )}
                    {!note.title && !note.content && (
                      <span className="block text-xs italic opacity-35" style={{ color: colors.textHex }}>Nota vacía</span>
                    )}
                  </span>
                  {recortada && (
                    <span className="shrink-0 text-xs font-semibold underline" style={{ color: colors.textHex, opacity: 0.7 }}>
                      Ver más
                    </span>
                  )}
                  {note.isEureka && (
                    <span
                      className="flex shrink-0 items-center gap-1 pt-1 text-[10px] uppercase tracking-wider"
                      style={{ color: colors.textHex, opacity: 0.7 }}
                    >
                      <Lightbulb aria-hidden className="size-3" /> Eureka
                    </span>
                  )}
                </button>
              )}

              {/* Los controles de la esquina. `data-no-drag` es lo que los saca
                  del arrastre en la capa flotante: la tarjeta entera mueve la
                  nota menos este trozo, que se pulsa. En el teléfono son uno
                  solo de 48 px que abre la hoja con las operaciones por nombre,
                  incluido dónde va la nota: sin arrastre, la posición también
                  se elige por nombre. */}
              <div
                data-no-drag
                className={cn(
                  "absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 transition-opacity duration-(--dur-toque) ease-(--ease-pluma) md:pointer-fine:opacity-0 md:pointer-fine:group-hover:opacity-100 md:pointer-fine:focus-within:opacity-100 pointer-coarse:top-0 pointer-coarse:right-0",
                  isMobile && "top-0 right-0"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {isMobile ? (
                  <RowActions
                    subject={note.title?.trim() || "Nota"}
                    revealOnHover={false}
                    className="text-inherit hover:bg-black/10"
                    actions={[
                      { label: "Editar", icon: Pencil, onSelect: empezarAEditar },
                      { label: note.isEureka ? "Quitar eureka" : "Marcar eureka", icon: Lightbulb, onSelect: toggleEureka },
                      ...(context.pageId && note.positionSide !== "left"
                        ? [{ label: "Pegar en el margen izquierdo", icon: PanelLeft, onSelect: () => pinToSide("left") }]
                        : []),
                      ...(context.pageId && note.positionSide !== "right"
                        ? [{ label: "Pegar en el margen derecho", icon: PanelRight, onSelect: () => pinToSide("right") }]
                        : []),
                      ...(context.pageId && note.positionSide
                        ? [{ label: "Mandar a la cuadrícula", icon: LayoutGrid, onSelect: () => pinToSide(null) }]
                        : []),
                      ...(onStack ? [{ label: "Apilar sobre otra nota", icon: Layers, onSelect: onStack }] : []),
                      { label: "Eliminar", icon: Trash2, destructive: true, onSelect: () => setConfirmarBorrado(true) },
                    ]}
                  />
                ) : (
                  <>
                    {context.pageId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-6 items-center justify-center rounded hover:bg-black/15 focus-ring pointer-coarse:size-[2.85rem]"
                            aria-label="Opciones de posición"
                          >
                            <MoreHorizontal className="size-3.5" style={{ color: colors.textHex }} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {note.positionSide !== "left" && (
                            <DropdownMenuItem onClick={() => pinToSide("left")}>
                              <PanelLeft /> Margen izquierdo
                            </DropdownMenuItem>
                          )}
                          {note.positionSide !== "right" && (
                            <DropdownMenuItem onClick={() => pinToSide("right")}>
                              <PanelRight /> Margen derecho
                            </DropdownMenuItem>
                          )}
                          {note.positionSide && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => pinToSide(null)}>
                                <LayoutGrid /> Mandar a la cuadrícula
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmarBorrado(true)}
                      className="flex size-6 items-center justify-center rounded hover:bg-black/15 focus-ring pointer-coarse:size-[2.85rem]"
                      aria-label="Eliminar nota"
                    >
                      <X className="size-3.5" style={{ color: colors.textHex }} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem className="gap-2" onSelect={empezarAEditar}>
            <Pencil className="size-3.5" /> Editar
          </ContextMenuItem>
          <ContextMenuItem className="gap-2" onSelect={toggleEureka}>
            <Lightbulb className="size-3.5" />
            {note.isEureka ? "Quitar eureka" : "Marcar eureka"}
          </ContextMenuItem>
          {onStack && (
            <ContextMenuItem className="gap-2" onSelect={onStack}>
              <Layers className="size-3.5" /> Apilar sobre otra nota
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" className="gap-2" onSelect={() => setConfirmarBorrado(true)}>
            <Trash2 className="size-3.5" /> Eliminar
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <ConfirmDialog
        open={confirmarBorrado}
        title="Eliminar nota"
        description={
          anota
            ? `"${nombreDeNota(note)}" se eliminará, y con ella su marca en el texto.`
            : `"${nombreDeNota(note)}" se eliminará.`
        }
        onConfirm={() => deleteNote(note.id)}
        onCancel={() => setConfirmarBorrado(false)}
      />
    </>
  );
});
