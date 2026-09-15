"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import { StickyNoteCard } from "./StickyNoteCard";
import { useUpdateStickyNote } from "./sticky-notes.hooks";
import { useSharedEditor } from "@/features/pages/EditorContext";
import {
  removeAnchorMark,
  applyAnchorMarkAtPos,
  getAnchorTop,
} from "./anchor-utils";
import { clampToGutter, resolveColumnX, type NotebookMetrics } from "./sticky-position";
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
  const [noteH, setNoteH] = useState(120);

  const { mutate: updateNote } = useUpdateStickyNote(context);

  const maxTop = Math.max(0, metrics.containerH - noteH);

  // Posición base (px, relativa al contenedor) derivada del modelo columna-relativo.
  const colX = resolveColumnX(note.positionSide, note.positionX);
  const baseLeft = metrics.columnLeft + colX * metrics.columnWidth;
  // La Y sale del ancla, en pixeles y sin pasar por una fraccion. `positionY`
  // es el respaldo de una nota cuya ancla se quedo huerfana.
  const baseTop =
    note.anchorId && anchorTop !== null
      ? anchorTop
      : (note.positionY ?? 0.12) * metrics.containerH;

  const isDragging = live !== null;
  // Clamp final: la nota nunca se sale de la pantalla.
  const leftPx = clampToGutter(live?.leftPx ?? baseLeft, metrics);
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

  // Alto real de la nota, para el clamp vertical (sin leer el ref en render).
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setNoteH(el.offsetHeight));
    ro.observe(el);
    setNoteH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

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
    setLive({ leftPx: clampToGutter(ds.leftPx + dx, metrics), topPx: clamp(ds.topPx + dy, 0, maxTop) });
  }

  function onPointerUp() {
    const ds = dragStart.current;
    dragStart.current = null;
    const snapshot = live;
    setLive(null);
    // Sin arrastre el gesto fue un click, y el navegador ya lo entrega solo.
    if (!ds || !ds.started || !snapshot) return;

    suppressNextClick();

    const nextX =
      metrics.columnWidth > 0
        ? (snapshot.leftPx - metrics.columnLeft) / metrics.columnWidth
        : 0;
    const nextY = metrics.containerH > 0 ? snapshot.topPx / metrics.containerH : 0;

    // Toda nota se vuelve a anclar al soltarla, no solo la que ya venia anclada.
    // Su Y sale del parrafo donde cae, que se mueve con el texto; `positionY`
    // era una fraccion de la altura del documento, y un documento crece cada vez
    // que escribes, asi que la nota se despegaba de la frase que acompanaba.
    // El ancla nueva va `muted`: sostiene la nota, no marca ese texto.
    const containerTop = containerRef.current?.getBoundingClientRect().top ?? 0;
    const anchorPos = posAtDrop(containerTop + snapshot.topPx);
    if (anchorPos !== null && editor) {
      const newAnchorId = crypto.randomUUID();
      if (note.anchorId) removeAnchorMark(editor, note.anchorId);
      applyAnchorMarkAtPos(editor, anchorPos, newAnchorId, true);
      updateNote({
        noteId: note.id,
        data: { positionSide: "over", positionX: nextX, positionY: nextY, anchorId: newAnchorId },
      });
      return;
    }

    // Sin editor o sin parrafo debajo (una nota sobre el hueco final), la Y se
    // guarda como fraccion. Es el respaldo, no el camino normal.
    updateNote({
      noteId: note.id,
      data: { positionSide: "over", positionX: nextX, positionY: nextY },
    });
  }

  /** El sitio del documento que queda a la altura del punto donde soltaste. */
  function posAtDrop(clientY: number): number | null {
    if (!editor || !containerRef.current) return null;
    const containerRect = containerRef.current.getBoundingClientRect();
    const textCenterX = containerRect.left + metrics.columnLeft + metrics.columnWidth / 2;
    const result = editor.view.posAtCoords({ left: textCenterX, top: clientY });
    return result ? result.pos : null;
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
        transform: `rotate(${isDragging ? 0 : tilt}deg)`,
        transition: isDragging ? "none" : "transform 160ms ease",
        zIndex,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <StickyNoteCard note={note} context={context} compact />
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
