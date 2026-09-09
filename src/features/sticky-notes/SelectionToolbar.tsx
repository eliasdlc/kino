'use client';

import { useWordGate } from '@/features/settings/word-gate';

interface SelectionToolbarProps {
  /** El texto seleccionado ahora mismo en el editor. Vacío si no hay selección. */
  selection: string;
  /** Abre el creador de nota adhesiva anclado a esa selección. */
  onAnnotate: (selection: string) => void;
}

/**
 * La puerta de la nota adhesiva, y el gesto más fino del producto: seleccionar
 * un trozo de texto es lo que hace aparecer la palabra.
 *
 * Hasta ahora las notas sólo nacían con click derecho sobre un hueco vacío, que
 * es un gesto que nadie descubre solo y que además no ancla la nota a nada.
 * Aquí la nota nace pegada a lo que estabas leyendo.
 *
 * Aparece una vez. Después, la selección sigue funcionando igual desde el menú
 * del editor: lo que no vuelve es la palabra explicándose.
 */
export function SelectionToolbar({ selection, onAnnotate }: SelectionToolbarProps) {
  const visible = useWordGate('notaAdhesiva', selection.trim().length > 0);
  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
      <p className="min-w-0 text-foreground/80">Lo que marcaste puede llevar una nota adhesiva.</p>
      <button
        type="button"
        onClick={() => onAnnotate(selection)}
        className="ml-auto min-h-12 shrink-0 rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        Anotarlo
      </button>
    </div>
  );
}
