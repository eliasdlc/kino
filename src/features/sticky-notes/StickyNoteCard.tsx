"use client";

import { useEffect, useRef, useState } from "react";
import { X, Layers, Lightbulb, Loader2, MoreHorizontal, PanelLeft, PanelRight, PinOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  /**
   * La nota flota sobre el texto. Ahí la tarjeta se acota: los 500 caracteres
   * que el schema permite se pintaban en 573 px de alto sobre 176 de ancho y
   * se comían la página. En la rejilla no hace falta, porque la rejilla fluye.
   */
  compact?: boolean;
}

const EDIT_POPOVER_W = 300;
const EDIT_POPOVER_H_EST = 260;
const EDIT_MARGIN = 8;

function editPopoverStyle(anchor: { x: number; y: number }): React.CSSProperties {
  if (typeof window === "undefined") return { left: anchor.x, top: anchor.y };
  const left = Math.min(Math.max(EDIT_MARGIN, anchor.x), window.innerWidth - EDIT_POPOVER_W - EDIT_MARGIN);
  const top =
    anchor.y + EDIT_POPOVER_H_EST > window.innerHeight - EDIT_MARGIN
      ? Math.max(EDIT_MARGIN, anchor.y - EDIT_POPOVER_H_EST)
      : anchor.y;
  return { left, top, width: EDIT_POPOVER_W };
}

function EditOverlay({
  note,
  context,
  anchorPoint,
  onClose,
}: {
  note: StickyNoteItem;
  context: { pageId?: string; folderId?: string };
  anchorPoint: { x: number; y: number };
  onClose: () => void;
}) {
  const { mutate: updateNote, isPending } = useUpdateStickyNote(context);
  const [title, setTitle] = useState(note.title ?? "");
  const [content, setContent] = useState(note.content ?? "");
  const [color, setColor] = useState(note.color);
  const colors = STICKY_NOTE_COLORS[color] ?? STICKY_NOTE_COLORS.yellow!;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    updateNote(
      { noteId: note.id, data: { title: title || null, content: content || null, color: color as never } },
      { onSuccess: onClose }
    );
  }

  return (
    <>
      {/* Backdrop transparente: cierra al hacer click fuera sin tapar la página. */}
      <div className="fixed inset-0 z-(--z-modal)" onClick={onClose} />

      <div
        className="fixed z-(--z-modal) rounded-2xl shadow-2xl border border-border bg-white dark:bg-card p-3 space-y-3"
        style={editPopoverStyle(anchorPoint)}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="rounded-lg p-3 flex flex-col gap-1"
          style={{ ...paperStyle(colors.hex), color: colors.textHex }}
        >
          <input
            autoFocus
            type="text"
            placeholder="Título..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="bg-transparent outline-none text-base font-semibold placeholder:opacity-30 w-full"
            style={{ color: colors.textHex }}
          />
          <textarea
            placeholder="Escribe aquí..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            className="bg-transparent outline-none resize-none placeholder:opacity-30 w-full text-sm leading-relaxed"
            style={{ color: colors.textHex }}
          />
        </div>

        <div className="flex gap-2 flex-wrap px-0.5">
          {COLOR_PICKER_OPTIONS.map((c) => {
            const cls = STICKY_NOTE_COLORS[c]!;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c as typeof color)}
                aria-label={c}
                className="size-6 rounded-full transition-all"
                style={{
                  backgroundColor: cls.hex,
                  border: `2.5px solid ${color === c ? "#00000055" : "transparent"}`,
                  transform: color === c ? "scale(1.2)" : "scale(1)",
                }}
              />
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button size="sm" className="flex-1" onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Alto máximo de una nota que flota sobre el texto, en px. */
const COMPACT_MAX_H = 168;

export function StickyNoteCard({ note, context, onStack, compact }: StickyNoteCardProps) {
  const { mutate: removeNote } = useDeleteStickyNote(context);
  const { mutate: updateNote } = useUpdateStickyNote(context);
  const editor = useSharedEditor();
  const [editAnchor, setEditAnchor] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [recortada, setRecortada] = useState(false);
  const colors = STICKY_NOTE_COLORS[note.color] ?? STICKY_NOTE_COLORS.yellow!;
  const { lit, light } = useAnchorHighlight();

  // La nota es media pareja sólo si su ancla anota una frase. La de posición no
  // marca ningún texto, así que no hay nada al otro lado que encender.
  const anota =
    !!note.anchorId && !!editor && isAnnotationAnchor(editor.state.doc, note.anchorId);
  const encendida = anota && lit === note.anchorId;
  const editando = editAnchor !== null;

  // Con el editor de la nota abierto, su frase se queda encendida. Es lo único
  // que da la pareja exacta sin puntero, y en el teléfono no hay puntero: ahí
  // abrir la nota es el gesto que dice cuál de las frases comenta.
  useEffect(() => {
    if (!anota || !editando) return;
    light(note.anchorId);
    return () => light(null);
  }, [anota, editando, light, note.anchorId]);

  // Si el texto no cabe en el tope. Se mide en vez de contar caracteres: lo que
  // cabe depende de la letra del sistema, que el usuario cambia.
  useEffect(() => {
    const el = bodyRef.current;
    if (!compact || !el) return;
    const medir = () => setRecortada(el.scrollHeight > el.clientHeight + 1);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, note.title, note.content]);

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

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={cardRef}
            data-sticky-note
            data-lit={encendida ? "" : undefined}
            className="group relative flex flex-col gap-1 cursor-pointer rounded-lg p-3.5 w-full min-h-[90px]"
            style={{
              ...paperStyle(colors.hex, encendida ? { ink: colors.textHex } : undefined),
              color: colors.textHex,
            }}
            onMouseEnter={() => anota && light(note.anchorId)}
            onMouseLeave={() => anota && !editando && light(null)}
            onClick={(e) => setEditAnchor({ x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top })}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                const r = e.currentTarget.getBoundingClientRect();
                setEditAnchor({ x: r.left, y: r.top });
              }
            }}
          >
            <div
              ref={bodyRef}
              className="flex flex-col gap-1 overflow-hidden"
              style={compact ? { maxHeight: COMPACT_MAX_H } : undefined}
            >
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
              <p className="text-xs font-semibold underline" style={{ color: colors.textHex, opacity: 0.7 }}>
                Ver más
              </p>
            )}

            {note.isEureka && (
              <span
                className="mt-auto flex items-center gap-1 pt-1 text-[10px] uppercase tracking-wider"
                style={{ color: colors.textHex, opacity: 0.7 }}
              >
                <Lightbulb className="size-3" /> Eureka
              </span>
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
                          <PinOff className="size-3" /> Quitar del margen
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem
            className="gap-2"
            onSelect={() => {
              const r = cardRef.current?.getBoundingClientRect();
              setEditAnchor(r ? { x: r.left, y: r.top } : { x: 80, y: 80 });
            }}
          >
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

      {editAnchor && (
        <EditOverlay
          note={note}
          context={context}
          anchorPoint={editAnchor}
          onClose={() => setEditAnchor(null)}
        />
      )}
    </>
  );
}
