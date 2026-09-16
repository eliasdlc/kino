"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import { StickyNoteCard } from "./StickyNoteCard";
import { useUpdateStickyNote } from "./sticky-notes.hooks";
import { useSharedEditor } from "@/features/pages/EditorContext";
import { getAnchorTop } from "./anchor-utils";
import { dropNote } from "./drop-note";
import { clampToCanvas, NOTE_W, resolveColumnX, type NotebookMetrics } from "./sticky-position";
import type { StickyNoteItem } from "./sticky-notes.types";

interface FloatingNotesLayerProps {
  notes: StickyNoteItem[];
  context: { pageId: string };
  /** Contenedor de scroll del cuaderno; define el área donde puede vivir la nota. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** La geometría del cuaderno, medida una vez por quien monta esta capa. */
  metrics: NotebookMetrics;
}

type Metrics = NotebookMetrics;

/** Por debajo de esto el gesto es un click, no un arrastre. */
const DRAG_THRESHOLD_PX = 4;

/**
 * La franja de z que ocupan las notas entre ellas: de `--z-raised` (10) a 19,
 * siempre por debajo de `--z-overlay` (20). Una nota se pinta sobre el texto y
 * nunca sobre un menu, un dialogo o un aviso.
 */
const Z_BASE = 10;
const Z_SLOTS = 9;

/** Puesto de una nota en el orden de uso: la ultima que tocaste queda arriba. */
function zIndexFor(id: string, ranked: string[]): number {
  const desdeArriba = ranked.length - 1 - ranked.indexOf(id);
  return Z_BASE + Z_SLOTS - Math.min(desdeArriba, Z_SLOTS);
}

/**
 * Se come el `click` que el navegador dispara al final de un arrastre, para que
 * soltar la nota no abra su editor. Se retira sola si ese click nunca llega.
 */
function suppressNextClick() {
  const cleanup = () => {
    document.removeEventListener("click", swallow, true);
    clearTimeout(timer);
  };
  function swallow(ev: MouseEvent) {
    ev.stopPropagation();
    ev.preventDefault();
    cleanup();
  }
  const timer = setTimeout(cleanup, 300);
  document.addEventListener("click", swallow, true);
}

function tiltFor(id: string): number {
  const sum = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const mag = 1 + (sum % 3);
  return sum % 2 === 0 ? mag : -mag;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

interface DragStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  leftPx: number;
  topPx: number;
  /** Falso mientras el gesto siga pudiendo ser un click. */
  started: boolean;
}

function FloatingNoteItem({
  note,
  context,
  containerRef,
  metrics,
  zIndex,
  onInteract,
}: {
  note: StickyNoteItem;
  context: { pageId: string };
  containerRef: RefObject<HTMLDivElement | null>;
  metrics: Metrics;
  zIndex: number;
  onInteract: (id: string) => void;
}) {
  const editor = useSharedEditor();
  const noteRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<DragStart | null>(null);
  const [live, setLive] = useState<{ leftPx: number; topPx: number } | null>(null);
  const [anchorTop, setAnchorTop] = useState<number | null>(null);

  const { mutate: updateNote } = useUpdateStickyNote(context);

  // La nota es un cuadrado de lado fijo: el tope vertical sale de ahí.
  const maxTop = Math.max(0, metrics.containerH - NOTE_W);

  // Posición base (px, relativa al contenedor) derivada del modelo columna-relativo.
  const colX = resolveColumnX(note.positionSide, note.positionX);
  const baseLeft = metrics.columnLeft + colX * metrics.columnWidth;
  // La Y es donde la soltaste: el ancla dice por donde va su parrafo y el
  // desfase, cuanto por encima o por debajo de el la pusiste. Asi la nota se
  // queda exactamente donde la pegaste y aun asi baja con el texto cuando
  // escribes por encima. `positionY` es el respaldo de un ancla huerfana.
  const baseTop =
    note.anchorId && anchorTop !== null
      ? anchorTop + (note.offsetY ?? 0)
      : (note.positionY ?? 0.12) * metrics.containerH;

  const isDragging = live !== null;
  // Clamp final: la nota nunca se sale de la pantalla.
  const leftPx = clampToCanvas(live?.leftPx ?? baseLeft, metrics);
  const topPx = clamp(live?.topPx ?? baseTop, 0, maxTop);
  const tilt = tiltFor(note.id);

  const computeAnchorTop = useCallback(() => {
    if (!note.anchorId || !editor || !containerRef.current) return;
    setAnchorTop(getAnchorTop(editor, note.anchorId, containerRef.current));
    // `metrics` entra en las dependencias porque el ancla tambien se mueve
    // cuando la ventana cambia de ancho y el texto se re-ajusta.
  }, [note.anchorId, editor, containerRef]);

  useEffect(() => {
    computeAnchorTop();
    if (!editor) return;
    editor.on("update", computeAnchorTop);
    return () => {
      editor.off("update", computeAnchorTop);
    };
  }, [editor, computeAnchorTop, metrics.containerW, metrics.containerH]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // React sube los eventos de un portal a su padre de React, no al del DOM.
    // Los dos menus de la nota se montan en <body>, asi que sin esta guarda
    // pulsar uno de sus items arrancaria un arrastre y le robaria su click.
    if (!e.currentTarget.contains(e.target as Node)) return;
    // Los controles de la tarjeta se pulsan; el resto de la tarjeta arrastra.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    onInteract(note.id);
    dragStart.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      leftPx,
      topPx,
      started: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const ds = dragStart.current;
    if (!ds || e.pointerId !== ds.pointerId) return;
    const dx = e.clientX - ds.clientX;
    const dy = e.clientY - ds.clientY;
    if (!ds.started) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      // La captura llega aqui y no en el pointerdown: mientras el gesto pueda
      // ser un click, ese click tiene que llegar al boton o a la tarjeta.
      ds.started = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setLive({ leftPx: clampToCanvas(ds.leftPx + dx, metrics), topPx: clamp(ds.topPx + dy, 0, maxTop) });
  }

  function onPointerUp() {
    const ds = dragStart.current;
    dragStart.current = null;
    const snapshot = live;
    setLive(null);
    // Sin arrastre el gesto fue un click, y el navegador ya lo entrega solo.
    if (!ds || !ds.started || !snapshot || !containerRef.current) return;

    suppressNextClick();

    // La escritura es optimista: la lista de notas ya trae la posición nueva
    // en este mismo tick, así que soltar `live` no la devuelve a la vieja.
    updateNote({
      noteId: note.id,
      data: dropNote({
        note,
        editor,
        container: containerRef.current,
        metrics,
        leftPx: snapshot.leftPx,
        topPx: snapshot.topPx,
      }),
    });
  }

  function onPointerCancel() {
    dragStart.current = null;
    setLive(null);
  }

  return (
    <div
      ref={noteRef}
      className="absolute w-44 pointer-events-auto touch-none select-none"
      style={{
        top: `${topPx}px`,
        left: `${leftPx}px`,
        // Levantada, la nota se endereza y crece un poco, como el papel que
        // despegas de la mesa; al soltarla vuelve a caer con su inclinación.
        transform: isDragging ? "rotate(0deg) scale(1.04)" : `rotate(${tilt}deg)`,
        filter: isDragging ? "drop-shadow(0 14px 18px rgba(0,0,0,0.28))" : undefined,
        transition: isDragging ? "none" : "transform 160ms ease",
        zIndex,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <StickyNoteCard note={note} context={context} />
    </div>
  );
}

export function FloatingNotesLayer({
  notes,
  context,
  containerRef,
  metrics,
}: FloatingNotesLayerProps) {
  const [zOrder, setZOrder] = useState<Record<string, number>>({});
  const nextZ = useRef(1);

  function bringToFront(id: string) {
    nextZ.current += 1;
    setZOrder((prev) => ({ ...prev, [id]: nextZ.current }));
  }

  if (notes.length === 0) return null;

  // El contador de uso crece sin freno, pero lo que llega al DOM es el puesto
  // en ese orden, no el contador: por eso ninguna nota escala hasta los avisos.
  const ranked = notes
    .map((n) => n.id)
    .sort((a, b) => (zOrder[a] ?? 0) - (zOrder[b] ?? 0));

  return (
    <div className="absolute inset-0 pointer-events-none">
      {notes.map((n) => (
        <FloatingNoteItem
          key={n.id}
          note={n}
          context={context}
          containerRef={containerRef}
          metrics={metrics}
          zIndex={zIndexFor(n.id, ranked)}
          onInteract={bringToFront}
        />
      ))}
    </div>
  );
}
