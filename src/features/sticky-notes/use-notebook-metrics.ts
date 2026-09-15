"use client";

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";
import type { NotebookMetrics } from "./sticky-position";

const VACIO: NotebookMetrics = {
  columnLeft: 0,
  columnWidth: 0,
  textLeft: 0,
  textWidth: 0,
  containerW: 0,
  containerH: 0,
};

/**
 * Mide el cuaderno una sola vez para todos los que lo necesitan.
 *
 * Antes lo medía sólo la capa flotante, así que la rejilla no sabía si había
 * margen y decidía por CSS (`md:hidden` contra `hidden md:block`): cada nota
 * flotante se montaba dos veces, una oculta en cada rama. Con la medida aquí,
 * quién dibuja cada nota se decide en un sitio y se monta una vez.
 *
 * Devuelve también `remeasure` porque un `ResizeObserver` observa tamaños y no
 * posiciones: cuando la columna deja de estar centrada para hacerle sitio a una
 * nota, mide lo mismo y está en otro sitio, y nadie avisa.
 */
export function useNotebookMetrics(
  containerRef: RefObject<HTMLDivElement | null>,
  columnRef: RefObject<HTMLDivElement | null>
): { metrics: NotebookMetrics; remeasure: () => void } {
  const [metrics, setMetrics] = useState<NotebookMetrics>(VACIO);

  const remeasure = useCallback(() => {
    const container = containerRef.current;
    const column = columnRef.current;
    if (!container || !column) return;
    const cr = container.getBoundingClientRect();
    const colr = column.getBoundingClientRect();
    // El padding de la columna no lleva texto, así que una nota puede entrar
    // ahí. El margen útil se mide contra el texto, no contra la caja.
    const cs = getComputedStyle(column);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const columnLeft = colr.left - cr.left;
    setMetrics((prev) => {
      const next: NotebookMetrics = {
        columnLeft,
        columnWidth: colr.width,
        textLeft: columnLeft + padL,
        textWidth: Math.max(0, colr.width - padL - padR),
        containerW: container.clientWidth,
        containerH: container.offsetHeight,
      };
      const igual = (Object.keys(next) as Array<keyof NotebookMetrics>).every(
        (k) => Math.abs(next[k] - prev[k]) < 0.5
      );
      return igual ? prev : next;
    });
  }, [containerRef, columnRef]);

  useEffect(() => {
    const container = containerRef.current;
    const column = columnRef.current;
    if (!container || !column) return;
    remeasure();
    const ro = new ResizeObserver(remeasure);
    ro.observe(container);
    ro.observe(column);
    return () => ro.disconnect();
  }, [containerRef, columnRef, remeasure]);

  return { metrics, remeasure };
}
