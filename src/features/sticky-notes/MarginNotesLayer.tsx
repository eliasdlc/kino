"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StickyNoteCard } from "./StickyNoteCard";
import { useUpdateStickyNote, stickyNoteKeys } from "./sticky-notes.hooks";
import { useSharedEditor } from "@/features/pages/EditorContext";
import {
  removeAnchorMark,
  applyAnchorMarkAtPos,
  getAnchorYFraction,
} from "./anchor-utils";
import type { StickyNoteItem } from "./sticky-notes.types";

interface MarginNotesLayerProps {
  notes: StickyNoteItem[];
  context: { pageId: string };
  containerRef: RefObject<HTMLDivElement | null>;
}

const TEXT_COL_MAX_PX = 768; // max-w-3xl
const NOTE_W = 176;          // w-44

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
  posX: number;
  posY: number;
  side: "left" | "right";
}

interface LivePos {
  x: number;
  y: number;
  side: "left" | "right";
}

function MarginNoteItem({
  note,
  context,
  containerRef,
  gutterWidth,
  zIndex,
  onInteract,
}: {
  note: StickyNoteItem;
  context: { pageId: string };
  containerRef: RefObject<HTMLDivElement | null>;
  gutterWidth: number;
  zIndex: number;
  onInteract: (id: string) => void;
}) {
  const editor = useSharedEditor();
  const noteRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<DragStart | null>(null);
  const [live, setLive] = useState<LivePos | null>(null);
  const [anchorY, setAnchorY] = useState<number | null>(null);

  const { mutate: updateNote } = useUpdateStickyNote(context);
  const qc = useQueryClient();

  const isDragging = live !== null;
  const side = live?.side ?? (note.positionSide === "right" ? "right" : "left");
  const posX = live?.x ?? (note.positionX ?? 0);
  // Use live Y during drag, anchor Y for anchored notes, stored Y as fallback
  const posY = live?.y ?? (note.anchorId && anchorY !== null ? anchorY : (note.positionY ?? 0.12));

  const maxX = gutterWidth > NOTE_W ? (gutterWidth - NOTE_W) / gutterWidth : 0;
  const tilt = tiltFor(note.id);

  // Recompute anchor Y whenever the editor content changes
  const computeAnchorY = useCallback(() => {
    if (!note.anchorId || !editor || !containerRef.current) return;
    const y = getAnchorYFraction(editor, note.anchorId, containerRef.current);
    setAnchorY(y);
  }, [note.anchorId, editor, containerRef]);

  useEffect(() => {
    computeAnchorY();
    if (!editor) return;
    editor.on("update", computeAnchorY);
    return () => { editor.off("update", computeAnchorY); };
  }, [editor, computeAnchorY]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onInteract(note.id);
    dragStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      posX: note.positionX ?? 0,
      posY: posY,
      side: note.positionSide === "right" ? "right" : "left",
    };
    void qc.cancelQueries({ queryKey: stickyNoteKeys.byPage(context.pageId) });
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const ds = dragStart.current;
    if (!ds) return;
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerH = container.offsetHeight;
    const noteH = noteRef.current?.offsetHeight ?? 120;

    const dxPx = e.clientX - ds.clientX;
    const dyPx = e.clientY - ds.clientY;

    const cursorRelX = e.clientX - containerRect.left;
    const newSide: "left" | "right" =
      cursorRelX < containerRect.width / 2 ? "left" : "right";

    let newX: number;
    if (gutterWidth <= 0) {
      newX = 0;
    } else if (newSide === ds.side) {
      const dxFrac = (ds.side === "left" ? dxPx : -dxPx) / gutterWidth;
      newX = clamp(ds.posX + dxFrac, 0, maxX);
    } else {
      if (newSide === "right") {
        const textRight = containerRect.left + containerRect.width - gutterWidth;
        newX = clamp((e.clientX - textRight) / gutterWidth, 0, maxX);
      } else {
        const textLeft = containerRect.left + gutterWidth;
        newX = clamp((textLeft - e.clientX) / gutterWidth, 0, maxX);
      }
    }

    const maxY = containerH > 0 ? Math.max(0, 1 - noteH / containerH) : 0.9;
    const newY = clamp(ds.posY + dyPx / containerH, 0, maxY);

    setLive({ x: newX, y: newY, side: newSide });
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const ds = dragStart.current;
    dragStart.current = null;
    const snapshot = live;
    setLive(null);

    if (!ds || !snapshot) return;

    const dist = Math.hypot(e.clientX - ds.clientX, e.clientY - ds.clientY);
    if (dist < 4) return;

    const suppressClick = (ev: MouseEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      document.removeEventListener("click", suppressClick, true);
    };
    document.addEventListener("click", suppressClick, true);

    const dyAbs = Math.abs(e.clientY - ds.clientY);

    // For anchored notes dragged vertically: re-anchor at drop position
    if (note.anchorId && dyAbs >= 40 && editor) {
      const container = containerRef.current;
      const containerRect = container?.getBoundingClientRect();
      const textCenterX = containerRect
        ? containerRect.left + containerRect.width / 2
        : e.clientX;

      const result = editor.view.posAtCoords({ left: textCenterX, top: e.clientY });
      if (result) {
        const newAnchorId = crypto.randomUUID();
        removeAnchorMark(editor, note.anchorId);
        applyAnchorMarkAtPos(editor, result.pos, newAnchorId);
        updateNote({
          noteId: note.id,
          data: { positionSide: snapshot.side, positionX: snapshot.x, anchorId: newAnchorId },
        });
        return;
      }
    }

    // Standard position save (free notes or horizontal drag of anchored notes)
    updateNote({
      noteId: note.id,
      data: {
        positionSide: snapshot.side,
        positionX: snapshot.x,
        // Don't overwrite positionY for anchored notes (it's derived from mark)
        ...(note.anchorId ? {} : { positionY: snapshot.y }),
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
        top: `${posY * 100}%`,
        left: side === "left" ? `${posX * gutterWidth}px` : undefined,
        right: side === "right" ? `${posX * gutterWidth}px` : undefined,
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
      <StickyNoteCard
        note={note}
        context={context}
      />
    </div>
  );
}

export function MarginNotesLayer({ notes, context, containerRef }: MarginNotesLayerProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [zOrder, setZOrder] = useState<Record<string, number>>({});
  const nextZ = useRef(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry!.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, [containerRef]);

  const gutterWidth = Math.max(0, (containerWidth - TEXT_COL_MAX_PX) / 2);

  function bringToFront(id: string) {
    nextZ.current += 1;
    setZOrder((prev) => ({ ...prev, [id]: nextZ.current }));
  }

  if (notes.length === 0) return null;

  return (
    <div className="hidden md:block absolute inset-0 pointer-events-none">
      {notes.map((n) => (
        <MarginNoteItem
          key={n.id}
          note={n}
          context={context}
          containerRef={containerRef}
          gutterWidth={gutterWidth}
          zIndex={30 + (zOrder[n.id] ?? 0)}
          onInteract={bringToFront}
        />
      ))}
    </div>
  );
}
