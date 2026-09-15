"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { NotebookMetrics } from "./sticky-position";

/**
 * Mide el cuaderno una sola vez para todos los que lo necesitan.
 *
 * Antes lo medía sólo la capa flotante, así que la rejilla no sabía si había
 * margen y decidía por CSS (`md:hidden` contra `hidden md:block`): cada nota
 * flotante se montaba dos veces, una oculta en cada rama. Con la medida aquí,
 * quién dibuja cada nota se decide en un sitio y se monta una vez.
 */
export function useNotebookMetrics(
  containerRef: RefObject<HTMLDivElement | null>,
  columnRef: RefObject<HTMLDivElement | null>
): NotebookMetrics {
  const [metrics, setMetrics] = useState<NotebookMetrics>({
    columnLeft: 0,
    columnWidth: 768,
    textLeft: 0,
    textWidth: 768,
    containerW: 0,
    containerH: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    const column = columnRef.current;
    if (!container || !column) return;

    const measure = () => {
      const cr = container.getBoundingClientRect();
      const colr = column.getBoundingClientRect();
      // El padding de la columna no lleva texto, así que una nota puede entrar
      // ahí. El margen útil se mide contra el texto, no contra la caja.
      const cs = getComputedStyle(column);
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padR = parseFloat(cs.paddingRight) || 0;
      const columnLeft = colr.left - cr.left;
      setMetrics({
        columnLeft,
        columnWidth: colr.width,
        textLeft: columnLeft + padL,
        textWidth: Math.max(0, colr.width - padL - padR),
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

  return metrics;
}
