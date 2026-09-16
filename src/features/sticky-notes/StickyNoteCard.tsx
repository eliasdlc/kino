"use client";

import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
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

/**
 * La nota es un cuadrado de lado fijo, flote sobre el texto o esté en la
 * cuadrícula: el mismo papel en los dos sitios, y por eso arrastrarla de uno al
 * otro no la cambia de forma. Lo que no cabe se recorta y la nota avisa.
 *
 * Se edita sobre el propio papel: pulsarla cambia el texto por sus dos campos
 * en el mismo sitio, y la bandeja de colores sale por detrás. Se guarda al
 * pulsar fuera, con Escape o con Ctrl+Enter; el color se aplica al elegirlo.
 */
export function StickyNoteCard({ note, context, onStack }: StickyNoteCardProps) {
  const { mutate: removeNote } = useDeleteStickyNote(context);
  const { mutate: updateNote } = useUpdateStickyNote(context);
  const editor = useSharedEditor();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [recortada, setRecortada] = useState(false);
  const [editando, setEditando] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const colors = STICKY_NOTE_COLORS[note.color] ?? STICKY_NOTE_COLORS.yellow!;
  const { lit, light } = useAnchorHighlight();

  // La nota es media pareja sólo si su ancla anota una frase. La de posición no
  // marca ningún texto, así que no hay nada al otro lado que encender.
  const anota =
    !!note.anchorId && !!editor && isAnnotationAnchor(editor.state.doc, note.anchorId);
  const encendida = anota && lit === note.anchorId;

  function empezarAEditar() {
    if (editando) return;
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

  // El cursor entra al final del texto, que es donde se sigue escribiendo. Sin
  // desplazar: una nota que asoma por un borde no arrastra el cuaderno con ella.
  useEffect(() => {
    if (!editando) return;
    const el = contentRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(el.value.length, el.value.length);
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
   * nadie comentaba. El texto se queda; lo que se va es el span.
   */
  function deleteNote(id: string) {
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={wrapperRef} className="relative size-44">
          {/* La bandeja de colores vive detrás del papel y sale por abajo al
              editar. Está siempre montada para que el deslizamiento sea una
              transición y no un montaje; el papel es opaco y la tapa. */}
          <div
            data-no-drag
            inert={!editando}
            className={cn(
              "absolute inset-x-3 top-full z-0 -mt-2 flex flex-wrap justify-center gap-1.5 rounded-b-lg border border-border bg-card px-2 pb-2 pt-4 shadow-md transition-transform duration-200 ease-out",
              editando ? "translate-y-0" : "-translate-y-full"
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
                  aria-label={c}
                  aria-pressed={elegido}
                  className="size-5 rounded-full transition-transform"
                  style={{
                    backgroundColor: cls.hex,
                    border: `2px solid ${elegido ? "var(--foreground)" : "transparent"}`,
                    transform: elegido ? "scale(1.2)" : "scale(1)",
                  }}
                />
              );
            })}
          </div>

          <div
            data-sticky-note
            data-lit={encendida ? "" : undefined}
            className={cn(
              "group relative z-10 flex size-44 flex-col gap-1 overflow-hidden rounded-lg p-3.5",
              editando ? "cursor-text" : "cursor-pointer"
            )}
            style={{
              ...paperStyle(colors.hex, encendida ? { ink: colors.textHex } : undefined),
              color: colors.textHex,
            }}
            onMouseEnter={() => anota && light(note.anchorId)}
            onMouseLeave={() => anota && !editando && light(null)}
            onClick={empezarAEditar}
            role="button"
            tabIndex={editando ? -1 : 0}
            onKeyDown={(e) => {
              if (!editando && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                empezarAEditar();
              }
            }}
          >
            {editando ? (
              <div data-no-drag className="flex min-h-0 flex-1 select-text flex-col gap-1" {...sinArrastre}>
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
                  className="w-full bg-transparent text-sm font-semibold leading-tight outline-none placeholder:opacity-30"
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
              <>
                <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                  {note.title && (
                    <p className="font-semibold text-sm leading-tight break-words" style={{ color: colors.textHex }}>
                      {note.title}
                    </p>
                  )}
                  {note.content && (
                    <p
                      className="text-sm leading-snug whitespace-pre-wrap break-words"
                      style={{ color: colors.textHex, opacity: 0.88 }}
                    >
                      {note.content}
                    </p>
                  )}
                  {!note.title && !note.content && (
                    <p className="text-xs italic opacity-35" style={{ color: colors.textHex }}>Nota vacía</p>
                  )}
                </div>
                {recortada && (
                  <p className="shrink-0 text-xs font-semibold underline" style={{ color: colors.textHex, opacity: 0.7 }}>
                    Ver más
                  </p>
                )}
                {note.isEureka && (
                  <span
                    className="flex shrink-0 items-center gap-1 pt-1 text-[10px] uppercase tracking-wider"
                    style={{ color: colors.textHex, opacity: 0.7 }}
                  >
                    <Lightbulb className="size-3" /> Eureka
                  </span>
                )}
              </>
            )}

            {/* Los dos controles de la esquina. `data-no-drag` es lo que los
                saca del arrastre en la capa flotante: la tarjeta entera mueve
                la nota menos este trozo, que se pulsa. */}
            <div
              data-no-drag
              className="absolute top-1.5 right-1.5 flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              {context.pageId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="size-5 rounded flex items-center justify-center hover:bg-black/15"
                      aria-label="Opciones de posición"
                    >
                      <MoreHorizontal className="size-3" style={{ color: colors.textHex }} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {note.positionSide !== "left" && (
                      <DropdownMenuItem className="gap-2 text-xs" onClick={() => pinToSide("left")}>
                        <PanelLeft className="size-3" /> Margen izquierdo
                      </DropdownMenuItem>
                    )}
                    {note.positionSide !== "right" && (
                      <DropdownMenuItem className="gap-2 text-xs" onClick={() => pinToSide("right")}>
                        <PanelRight className="size-3" /> Margen derecho
                      </DropdownMenuItem>
                    )}
                    {note.positionSide && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-xs" onClick={() => pinToSide(null)}>
                          <LayoutGrid className="size-3" /> Mandar a la cuadrícula
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                type="button"
                onClick={() => deleteNote(note.id)}
                className="size-5 rounded flex items-center justify-center hover:bg-black/15"
                aria-label="Eliminar nota"
              >
                <X className="size-3" style={{ color: colors.textHex }} />
              </button>
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
        <ContextMenuItem variant="destructive" className="gap-2" onSelect={() => deleteNote(note.id)}>
          <Trash2 className="size-3.5" /> Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
