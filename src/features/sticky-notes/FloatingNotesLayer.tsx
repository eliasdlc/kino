"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import { StickyNoteCard } from "./StickyNoteCard";
import { useUpdateStickyNote } from "./sticky-notes.hooks";
import { useSharedEditor } from "@/features/pages/EditorContext";
import {
  removeAnchorMark,
  applyAnchorMarkAtPos,
  getAnchorYFraction,
} from "./anchor-utils";
import { resolveColumnX } from "./sticky-position";
import type { StickyNoteItem } from "./sticky-notes.types";

interface FloatingNotesLayerProps {
  notes: StickyNoteItem[];
  context: { pageId: string };
  /** Contenedor de scroll del cuaderno; define el área donde puede vivir la nota. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Columna de texto centrada; origen de coordenadas de las notas. */
  columnRef: RefObject<HTMLDivElement | null>;
}

/** Geometría del cuaderno en px, recalculada al redimensionar (abrir sidebar, etc.). */
interface Metrics {
  columnLeft: number; // px del borde izq. de la columna, relativo al contenedor
  columnWidth: number;
  containerW: number;
  containerH: number;
}

const NOTE_W = 176; // w-44

function tiltFor(id: string): number {
  const sum = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  const mag = 1 + (sum % 3);
  return sum % 2 === 0 ? mag : -mag;
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

interface DragStart {
  clientX: number;
  clientY: number;
  leftPx: number;
  topPx: number;
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
  const [anchorY, setAnchorY] = useState<number | null>(null);
  const [noteH, setNoteH] = useState(120);

  const { mutate: updateNote } = useUpdateStickyNote(context);

  const maxLeft = Math.max(0, metrics.containerW - NOTE_W);
  const maxTop = Math.max(0, metrics.containerH - noteH);

  // Posición base (px, relativa al contenedor) derivada del modelo columna-relativo.
  const colX = resolveColumnX(note.positionSide, note.positionX);
  const baseLeft = metrics.columnLeft + colX * metrics.columnWidth;
  // Notas ancladas a texto derivan su Y del mark; el resto usa positionY.
  const baseTopFrac =
    note.anchorId && anchorY !== null ? anchorY : note.positionY ?? 0.12;
  const baseTop = baseTopFrac * metrics.containerH;

  const isDragging = live !== null;
  // Clamp final: la nota nunca se sale de la pantalla.
  const leftPx = clamp(live?.leftPx ?? baseLeft, 0, maxLeft);
  const topPx = clamp(live?.topPx ?? baseTop, 0, maxTop);
  const tilt = tiltFor(note.id);

  const computeAnchorY = useCallback(() => {
    if (!note.anchorId || !editor || !containerRef.current) return;
    const y = getAnchorYFraction(editor, note.anchorId, containerRef.current);
    setAnchorY(y);
  }, [note.anchorId, editor, containerRef]);

  useEffect(() => {
    computeAnchorY();
    if (!editor) return;
    editor.on("update", computeAnchorY);
    return () => {
      editor.off("update", computeAnchorY);
    };
  }, [editor, computeAnchorY]);

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
    e.currentTarget.setPointerCapture(e.pointerId);
    onInteract(note.id);
    dragStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      leftPx,
      topPx,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const ds = dragStart.current;
    if (!ds) return;
    const nextLeft = clamp(ds.leftPx + (e.clientX - ds.clientX), 0, maxLeft);
    const nextTop = clamp(ds.topPx + (e.clientY - ds.clientY), 0, maxTop);
    setLive({ leftPx: nextLeft, topPx: nextTop });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const ds = dragStart.current;
    dragStart.current = null;
    const snapshot = live;
    setLive(null);
    if (!ds || !snapshot) return;

    const dist = Math.hypot(e.clientX - ds.clientX, e.clientY - ds.clientY);
    if (dist < 4) return; // fue un click, no un arrastre

    const suppressClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      document.removeEventListener("click", suppressClick, true);
    };
    document.addEventListener("click", suppressClick, true);

    const nextX =
      metrics.columnWidth > 0
        ? (snapshot.leftPx - metrics.columnLeft) / metrics.columnWidth
        : 0;
    const nextY = metrics.containerH > 0 ? snapshot.topPx / metrics.containerH : 0;
    const dyAbs = Math.abs(e.clientY - ds.clientY);

    // Nota anclada a texto arrastrada verticalmente: re-anclar en el drop.
    if (note.anchorId && dyAbs >= 40 && editor && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const textCenterX =
        containerRect.left + metrics.columnLeft + metrics.columnWidth / 2;
      const result = editor.view.posAtCoords({ left: textCenterX, top: e.clientY });
      if (result) {
        const newAnchorId = crypto.randomUUID();
        removeAnchorMark(editor, note.anchorId);
        applyAnchorMarkAtPos(editor, result.pos, newAnchorId);
        updateNote({
          noteId: note.id,
          data: { positionSide: "over", positionX: nextX, anchorId: newAnchorId },
        });
        return;
      }
    }

    // Al arrastrar libremente la nota pasa a ser flotante ('over'): así su X real
    // no se confunde con el formato legacy de gutter (ver resolveColumnX).
    updateNote({
      noteId: note.id,
      data: {
        positionSide: "over",
        positionX: nextX,
        ...(note.anchorId ? {} : { positionY: nextY }),
      },
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
      <StickyNoteCard note={note} context={context} />
    </div>
  );
}

export function FloatingNotesLayer({
  notes,
  context,
  containerRef,
  columnRef,
}: FloatingNotesLayerProps) {
  const [metrics, setMetrics] = useState<Metrics>({
    columnLeft: 0,
    columnWidth: 768,
    containerW: 0,
    containerH: 0,
  });
  const [zOrder, setZOrder] = useState<Record<string, number>>({});
  const nextZ = useRef(1);

  useEffect(() => {
    const container = containerRef.current;
    const column = columnRef.current;
    if (!container || !column) return;

    const measure = () => {
      const cr = container.getBoundingClientRect();
      const colr = column.getBoundingClientRect();
      setMetrics({
        columnLeft: colr.left - cr.left,
        columnWidth: colr.width,
        containerW: container.clientWidth,
        containerH: container.offsetHeight,
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(column);
    return () => ro.disconnect();
  }, [containerRef, columnRef]);

  function bringToFront(id: string) {
    nextZ.current += 1;
    setZOrder((prev) => ({ ...prev, [id]: nextZ.current }));
  }

  if (notes.length === 0) return null;

  return (
    <div className="hidden md:block absolute inset-0 pointer-events-none">
      {notes.map((n) => (
        <FloatingNoteItem
          key={n.id}
          note={n}
          context={context}
          containerRef={containerRef}
          metrics={metrics}
          zIndex={30 + (zOrder[n.id] ?? 0)}
          onInteract={bringToFront}
        />
      ))}
    </div>
  );
}
