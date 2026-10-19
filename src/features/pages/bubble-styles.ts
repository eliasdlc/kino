import { cn } from "@/lib/utils";

/**
 * El menú de la selección. Arriba de lo marcado y no debajo: en un teléfono lo
 * de abajo es el teclado. En un dedo cada botón mide 48 px, y ninguno encoge
 * ni parte su palabra: si la fila no cabe, se desplaza.
 */
export const BUBBLE =
  "flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-(--shadow)";
export const BUBBLE_BUTTON = cn(
  "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring",
  "hover:bg-secondary hover:text-foreground disabled:opacity-50 pointer-coarse:h-[2.85rem] pointer-coarse:min-w-[2.85rem] pointer-coarse:justify-center"
);
