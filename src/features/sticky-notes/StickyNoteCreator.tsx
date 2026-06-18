"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LayoutGrid, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCreateStickyNoteForPage, useCreateStickyNoteForFolder } from "./sticky-notes.hooks";
import { STICKY_NOTE_COLORS, COLOR_PICKER_OPTIONS, paperStyle } from "./sticky-note-colors";

type Context = { pageId: string; folderId?: never } | { folderId: string; pageId?: never };

type Placement = "grid" | "left" | "right";

interface StickyNoteCreatorProps {
  context: Context;
  onClose: () => void;
  textAnchor?: string;
  anchorId?: string;
}

export function StickyNoteCreator({ context, onClose, textAnchor, anchorId }: StickyNoteCreatorProps) {
  const isPage = "pageId" in context;
  const createForPage = useCreateStickyNoteForPage(isPage ? (context as { pageId: string }).pageId : "");
  const createForFolder = useCreateStickyNoteForFolder(!isPage ? (context as { folderId: string }).folderId : "");
  const { mutate: createNote, isPending } = isPage ? createForPage : createForFolder;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState<string>("yellow");
  // Notes created from a text selection default to left margin (anchored)
  const [placement, setPlacement] = useState<Placement>(anchorId ? "left" : "grid");
  const titleRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const colors = STICKY_NOTE_COLORS[color] ?? STICKY_NOTE_COLORS.yellow!;

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

  function handleSave() {
    if (!title.trim() && !content.trim()) { onClose(); return; }
    createNote(
      {
        title: title.trim() || undefined,
        content: content.trim() || undefined,
        color: color as never,
        textAnchor: textAnchor ?? undefined,
        anchorId: anchorId ?? undefined,
        ...(placement !== "grid" && isPage
          ? { positionSide: placement, positionY: 0.12, positionX: 0 }
          : {}),
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="w-full max-w-[420px] flex flex-col items-center px-4 sm:px-0 pb-4 sm:pb-0 gap-3">

        {/* The sticky note — large, square, editable */}
        <div
          className="w-[88%] aspect-square rounded-lg p-6 flex flex-col gap-1.5"
          style={{ ...paperStyle(colors.hex), transform: "rotate(-1.5deg)", color: colors.textHex }}
        >
          {textAnchor && (
            <p
              className="text-xs italic opacity-60 line-clamp-1 border-l-2 pl-2 mb-1"
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
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
            maxLength={200}
            className="bg-transparent outline-none text-lg font-semibold placeholder:opacity-30 w-full"
            style={{ color: colors.textHex }}
          />
          <textarea
            placeholder="Escribe algo aquí..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
            className="bg-transparent outline-none resize-none flex-1 placeholder:opacity-30 w-full text-sm leading-relaxed"
            style={{ color: colors.textHex }}
          />
        </div>

        {/* Bottom options panel */}
        <div className="w-full bg-white dark:bg-card rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
          {/* Color picker */}
          <div>
            <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">Color de la nota</p>
            <div className="flex gap-2.5 flex-wrap">
              {COLOR_PICKER_OPTIONS.map((c) => {
                const cls = STICKY_NOTE_COLORS[c]!;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={c}
                    className="size-8 rounded-full transition-all"
                    style={{
                      backgroundColor: cls.hex,
                      border: `3px solid ${color === c ? "#00000055" : "transparent"}`,
                      transform: color === c ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Placement — only for page context */}
          {isPage && (
            <div>
              <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wider">Colocar en</p>
              <div className="grid grid-cols-3 gap-2">
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
                      "flex flex-col items-center gap-1.5 py-3 rounded-2xl text-xs font-medium transition-all",
                      placement === id
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={isPending || (!title.trim() && !content.trim())}
            >
              {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              {isPending ? "Guardando..." : "Guardar nota"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
