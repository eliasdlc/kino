"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import type { StickyNoteItem } from "./sticky-notes.types";

interface StackNoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La nota que se va a apilar, o nada si la hoja está cerrada. */
  note: StickyNoteItem | null;
  /** Todas las notas del tablero; la que se apila se filtra aquí. */
  notes: StickyNoteItem[];
  onStack: (targetId: string) => void;
}

/** Lo que se lee de una nota cuando hay que elegirla de una lista. */
function noteLabel(note: StickyNoteItem): string {
  return note.title?.trim() || note.content?.trim() || "Nota vacía";
}

/**
 * Apilar sin arrastrar. El gesto de soltar una nota encima de otra no existe en
 * el teléfono, así que la operación se nombra y se elige el destino de una
 * lista, igual que la hoja de mover del tablero.
 */
export function StackNoteSheet({ open, onOpenChange, note, notes, onStack }: StackNoteSheetProps) {
  const targets = note ? notes.filter((candidate) => candidate.id !== note.id) : [];

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Apilar sobre</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{note ? noteLabel(note) : ""}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        {targets.length === 0 ? (
          <p className="pt-1 text-sm text-muted-foreground">
            No hay otra nota sobre la que apilar esta.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 pt-1">
            {targets.map((target) => (
              <li key={target.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onStack(target.id);
                  }}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border px-4 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-accent"
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{noteLabel(target)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
