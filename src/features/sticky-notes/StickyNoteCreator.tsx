"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LayoutGrid, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCreateStickyNoteForPage, useCreateStickyNoteForFolder } from "./sticky-notes.hooks";
import { STICKY_NOTE_COLORS, COLOR_PICKER_OPTIONS, paperStyle } from "./sticky-note-colors";
import { GUTTER_LEFT_X, GUTTER_RIGHT_X } from "./sticky-position";

type Context = { pageId: string; folderId?: never } | { folderId: string; pageId?: never };

type Placement = "grid" | "left" | "right";

const POPOVER_W = 300;
const POPOVER_H_EST = 300; // estimado para decidir si abrir hacia arriba
const MARGIN = 8;

interface StickyNoteCreatorProps {
  context: Context;
  onClose: () => void;
  /** Punto de pantalla junto al cual se abre el popover. */
  anchorPoint: { x: number; y: number };
  /** Si viene, la nota se crea flotante en esa posición (flujo de click derecho). */
  fixedPosition?: { positionX: number; positionY: number };
  textAnchor?: string;
  anchorId?: string;
}

/** Coloca el popover junto al punto de anclaje sin salirse de la ventana. */
function popoverStyle(anchor: { x: number; y: number }): React.CSSProperties {
  if (typeof window === "undefined") return { left: anchor.x, top: anchor.y };
  const left = Math.min(Math.max(MARGIN, anchor.x), window.innerWidth - POPOVER_W - MARGIN);
  const top =
    anchor.y + POPOVER_H_EST > window.innerHeight - MARGIN
      ? Math.max(MARGIN, anchor.y - POPOVER_H_EST)
      : anchor.y;
  return { left, top, width: POPOVER_W };
}

export function StickyNoteCreator({
  context,
  onClose,
  anchorPoint,
  fixedPosition,
  textAnchor,
  anchorId,
}: StickyNoteCreatorProps) {
  const isPage = "pageId" in context;
  const createForPage = useCreateStickyNoteForPage(isPage ? (context as { pageId: string }).pageId : "");
  const createForFolder = useCreateStickyNoteForFolder(!isPage ? (context as { folderId: string }).folderId : "");
  const { mutate: createNote, isPending } = isPage ? createForPage : createForFolder;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string>("yellow");
  // Notas creadas desde una selección de texto van al margen izquierdo por defecto.
  const [placement, setPlacement] = useState<Placement>(anchorId ? "left" : "grid");
  const titleRef = useRef<HTMLInputElement>(null);

  const colors = STICKY_NOTE_COLORS[color] ?? STICKY_NOTE_COLORS.yellow!;
  // Cuando la posición viene fija (click derecho) no mostramos el selector.
  const showPlacement = !fixedPosition && isPage;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function positionPayload() {
    if (fixedPosition) {
      return {
        positionSide: "over" as const,
        positionX: fixedPosition.positionX,
        positionY: fixedPosition.positionY,
      };
    }
    if (placement !== "grid" && isPage) {
      return {
        positionSide: placement,
        positionX: placement === "left" ? GUTTER_LEFT_X : GUTTER_RIGHT_X,
        positionY: 0.12,
      };
    }
    return {};
  }

  function handleSave() {
    if (!title.trim() && !content.trim()) {
      onClose();
      return;
    }
    createNote(
      {
        title: title.trim() || undefined,
        content: content.trim() || undefined,
        color: color as never,
        textAnchor: textAnchor ?? undefined,
        anchorId: anchorId ?? undefined,
        ...positionPayload(),
      },
      { onSuccess: onClose }
    );
  }

  return (
    <>
      {/* Backdrop transparente: cierra al hacer click fuera pero deja ver la página. */}
      <div className="fixed inset-0 z-(--z-modal)" onClick={onClose} />

      <div
        className="fixed z-(--z-modal) rounded-2xl shadow-2xl border border-border bg-white dark:bg-card p-3 space-y-3"
        style={popoverStyle(anchorPoint)}
        onClick={(e) => e.stopPropagation()}
      >
        {/* La nota: compacta, editable */}
        <div
          className="rounded-lg p-3 flex flex-col gap-1"
          style={{ ...paperStyle(colors.hex), color: colors.textHex }}
        >
          {textAnchor && (
            <p
              className="text-xs italic opacity-60 line-clamp-1 border-l-2 pl-2 mb-0.5"
              style={{ borderColor: colors.textHex, color: colors.textHex }}
            >
              &ldquo;{textAnchor}&rdquo;
            </p>
          )}
          <input
            ref={titleRef}
            type="text"
            placeholder="Título..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            maxLength={200}
            className="bg-transparent outline-none text-base font-semibold placeholder:opacity-30 w-full"
            style={{ color: colors.textHex }}
          />
          <textarea
            placeholder="Escribe algo aquí..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            rows={3}
            className="bg-transparent outline-none resize-none placeholder:opacity-30 w-full text-sm leading-relaxed"
            style={{ color: colors.textHex }}
          />
        </div>

        {/* Colores */}
        <div className="flex gap-2 flex-wrap px-0.5">
          {COLOR_PICKER_OPTIONS.map((c) => {
            const cls = STICKY_NOTE_COLORS[c]!;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
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

        {/* Colocación: solo cuando no viene una posición fija */}
        {showPlacement && (
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "left", icon: PanelLeft, label: "Margen izq." },
                { id: "grid", icon: LayoutGrid, label: "Cuadrícula" },
                { id: "right", icon: PanelRight, label: "Margen der." },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPlacement(id)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-all",
                  placement === id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleSave}
            disabled={isPending || (!title.trim() && !content.trim())}
          >
            {isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
            {isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </>
  );
}
