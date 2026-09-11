'use client';

/**
 * Items sueltos en Bandeja a partir de los cuales vale la pena decir algo. Ocho
 * es cuando el montón deja de leerse de un vistazo.
 */
export const ITEMS_PARA_EMPUJAR = 8;

interface GroupNudgeProps {
  /** Cuántos items hay en Bandeja ahora mismo. */
  count: number;
  /** Abre el triaje: el único control de la fila lleva a repartirlos de verdad. */
  onTriage: () => void;
}

/**
 * El primero de los dos empujes del principio 7, y el que **no** pasa por la
 * cola de una sola interrupción (D-18).
 *
 * Es una fila de estado: dice una cifra y ofrece una salida, pero no pide una
 * decisión, así que no gasta la única apertura del día. Sin esa distinción, un
 * lunes con la línea del digest más este empuje serían dos interrupciones y el
 * principio 8 dice una.
 *
 * Por eso tampoco hay un botón de descartar: no hay nada que acusar. La fila se
 * va cuando la Bandeja baja de ocho, no cuando alguien la silencia.
 *
 * Vive bajo el encabezado y sobre la lista, que es donde se lee antes que el
 * montón que describe.
 */
export function GroupNudge({ count, onTriage }: GroupNudgeProps) {
  if (count < ITEMS_PARA_EMPUJAR) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 text-sm">
      <p className="min-w-0 text-foreground/80">
        <b className="font-semibold text-foreground">{count}</b> cosas sin sistema.
      </p>
      <button
        type="button"
        onClick={onTriage}
        className="ml-auto min-h-12 shrink-0 rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        Repartirlas
      </button>
    </div>
  );
}
