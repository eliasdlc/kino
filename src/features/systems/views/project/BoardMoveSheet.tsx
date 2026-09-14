"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";

/** Un destino de la hoja: hacia dónde se puede mover lo que se está moviendo. */
export interface MoveDestination {
  id: string;
  label: string;
}

interface BoardMoveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Qué se está moviendo. Va en la hoja para que no sea anónima. */
  subject: string;
  destinations: readonly MoveDestination[];
  /** Dónde está ahora. Se pinta, no se puede elegir. */
  currentId: string;
  onMove: (destinationId: string) => void;
}

/**
 * El equivalente con nombre del arrastre. Sustituye al gesto en el teléfono y
 * convive con el arrastre en escritorio, así que los dos caminos terminan en la
 * misma mutación.
 *
 * La columna actual se pinta deshabilitada en vez de desaparecer: si se
 * ocultara, la lista cambiaría de largo según dónde esté la tarjeta y habría
 * que releerla entera cada vez. Que esté y no se pueda pulsar es además la
 * guarda de "mover a donde ya está", puesta donde se ve.
 */
export function BoardMoveSheet({
  open,
  onOpenChange,
  subject,
  destinations,
  currentId,
  onMove,
}: BoardMoveSheetProps) {
  function handleMove(destinationId: string) {
    onOpenChange(false);
    onMove(destinationId);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Mover a</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{subject}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ul className="flex flex-col gap-2 pt-1">
          {destinations.map((destination) => {
            const isCurrent = destination.id === currentId;
            return (
              <li key={destination.id}>
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleMove(destination.id)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-border px-4 text-left text-sm font-medium transition-colors enabled:hover:border-primary enabled:hover:bg-accent disabled:opacity-45"
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{destination.label}</span>
                  {isCurrent && (
                    <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      aquí
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
