'use client';

import { Button } from '@/components/ui/button';
import { MarginRow } from '@/components/ui/margin-row';

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
 * montón que describe. Es una fila de margen: la cifra en el margen, en
 * Bricolage y mute como el numeral de un índice, la frase en la columna de
 * texto y la salida a la derecha, a 48 px.
 */
export function GroupNudge({ count, onTriage }: GroupNudgeProps) {
  if (count < ITEMS_PARA_EMPUJAR) return null;

  return (
    <MarginRow
      className="last:border-b"
      margin={<span className="block pt-1.5 font-display text-lg font-bold text-muted-foreground tabular-nums">{count}</span>}
      trailing={
        <Button variant="ghost" onClick={onTriage} className="-mr-2 text-primary hover:text-primary">
          Repartirlas
        </Button>
      }
    >
      <span className="block text-body">cosas sin sistema</span>
    </MarginRow>
  );
}
