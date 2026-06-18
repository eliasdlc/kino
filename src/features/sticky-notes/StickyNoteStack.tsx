"use client";

import { useState } from "react";
import { STICKY_NOTE_COLORS, paperStyle } from "./sticky-note-colors";
import { StickyNoteCard } from "./StickyNoteCard";
import type { StickyNoteItem } from "./sticky-notes.types";

interface StickyNoteStackProps {
  notes: StickyNoteItem[];
  context: { pageId?: string; folderId?: string };
}

export function StickyNoteStack({ notes, context }: StickyNoteStackProps) {
  const [expanded, setExpanded] = useState(false);
  const top = notes[0]!;
  const rest = notes.slice(1);
  const topColors = STICKY_NOTE_COLORS[top.color] ?? STICKY_NOTE_COLORS.yellow!;
  const mid = rest[0] ? (STICKY_NOTE_COLORS[rest[0].color] ?? STICKY_NOTE_COLORS.yellow!) : topColors;
  const back = rest[1] ? (STICKY_NOTE_COLORS[rest[1].color] ?? STICKY_NOTE_COLORS.yellow!) : mid;

  if (expanded) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Colapsar pila ↑
        </button>
        {notes.map((n) => (
          <StickyNoteCard key={n.id} note={n} context={context} />
        ))}
      </div>
    );
  }

  return (
    <div
      className="relative cursor-pointer select-none"
      onClick={() => setExpanded(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setExpanded(true); }}
    >
      {/* Back layer */}
      {rest.length >= 2 && (
        <div
          className="absolute inset-0 rounded-lg"
          style={{ backgroundColor: back.hex, transform: "rotate(-4deg) translate(6px, 6px)", boxShadow: "0 6px 14px -8px rgba(0,0,0,0.4)" }}
        />
      )}
      {/* Middle layer */}
      {rest.length >= 1 && (
        <div
          className="absolute inset-0 rounded-lg"
          style={{ backgroundColor: mid.hex, transform: "rotate(-2deg) translate(3px, 3px)", boxShadow: "0 6px 14px -8px rgba(0,0,0,0.4)" }}
        />
      )}

      {/* Top card */}
      <div
        className="relative rounded-lg p-3.5 min-h-[120px] flex flex-col gap-1"
        style={{ ...paperStyle(topColors.hex), color: topColors.textHex }}
      >
        {top.title && (
          <p className="text-sm font-semibold line-clamp-2" style={{ color: topColors.textHex }}>{top.title}</p>
        )}
        {top.content && (
          <p className="text-xs opacity-90 line-clamp-4 whitespace-pre-wrap leading-snug" style={{ color: topColors.textHex }}>
            {top.content}
          </p>
        )}
        {!top.title && !top.content && (
          <p className="text-xs italic opacity-35" style={{ color: topColors.textHex }}>Nota vacía</p>
        )}

        {/* Count badge */}
        <div className="absolute -top-2 -right-2 size-6 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center shadow-md z-10">
          {notes.length}
        </div>
      </div>
    </div>
  );
}
