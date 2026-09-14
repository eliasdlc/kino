"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { OutlineItem } from "./mediums/outline";

/**
 * Lo que hace falta para navegar el índice dentro del DOM: encontrar el bloque
 * de una entrada, y saber cuál de ellas se está leyendo.
 */

/** Cuánto puede asomar un título por debajo del borde y seguir contando como leído. */
const CROSS_OFFSET = 96;

/**
 * El elemento del documento que corresponde a una entrada del índice. ProseMirror
 * devuelve a veces un nodo de texto en vez del bloque, de ahí el `parentElement`.
 */
export function outlineElement(editor: Editor, pos: number): HTMLElement | null {
  const dom = editor.view.nodeDOM(pos);
  if (dom instanceof HTMLElement) return dom;
  return (dom as ChildNode | null)?.parentElement ?? null;
}

/**
 * La sección que se está leyendo es la del último título que ya cruzó el borde
 * superior del lienzo. Antes del primer cruce lo es la primera, porque estar
 * arriba del documento es estar en su primera sección y no en ninguna.
 *
 * Se decide aquí, sobre dos datos planos, y no dentro del observador: así la
 * regla se puede romper en un test sin montar un scroll que jsdom no tiene.
 */
export function activeFromCrossings(
  positions: readonly number[],
  crossed: ReadonlySet<number>,
): number | null {
  let last: number | null = null;
  for (const pos of positions) if (crossed.has(pos)) last = pos;
  return last ?? positions[0] ?? null;
}

/**
 * Qué sección del documento se está leyendo, mirando los títulos con un
 * `IntersectionObserver` sobre el contenedor de scroll del editor.
 *
 * El observador solo avisa de los cruces; quién está activo lo decide
 * `activeFromCrossings`. Nada repinta en bucle: entre cruce y cruce esto no
 * corre.
 */
export function useActiveSection(
  editor: Editor | null,
  items: readonly OutlineItem[],
  scrollRef: RefObject<HTMLDivElement | null>,
): number | null {
  const [crossedPos, setCrossedPos] = useState<number | null>(null);
  // El índice se deriva de nuevo en cada tecleo, así que el array siempre es
  // otro. Lo que de verdad manda al observador es qué títulos hay y dónde.
  const signature = items.map((item) => item.pos).join(",");

  useEffect(() => {
    const scroller = scrollRef.current;
    const positions = signature ? signature.split(",").map(Number) : [];
    if (!editor || !scroller || positions.length === 0) return;

    const posOf = new Map<Element, number>();
    for (const pos of positions) {
      const element = outlineElement(editor, pos);
      if (element) posOf.set(element, pos);
    }
    if (posOf.size === 0) return;

    const crossed = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const pos = posOf.get(entry.target);
          if (pos === undefined) continue;
          const limit = (entry.rootBounds?.top ?? 0) + CROSS_OFFSET;
          if (entry.boundingClientRect.top <= limit) crossed.add(pos);
          else crossed.delete(pos);
        }
        setCrossedPos(activeFromCrossings(positions, crossed));
      },
      { root: scroller, threshold: 0 },
    );
    for (const element of posOf.keys()) observer.observe(element);
    return () => observer.disconnect();
  }, [editor, signature, scrollRef]);

  // Se deriva en vez de guardarse: mientras el observador vuelve a arrancar, el
  // título que estaba activo puede haberse borrado, y una marca encendida que
  // ya no existe sería peor que ninguna.
  return items.some((item) => item.pos === crossedPos) ? crossedPos : null;
}
