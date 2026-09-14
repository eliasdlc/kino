"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { OutlineItem } from "./mediums/outline";

/**
 * El carril de títulos: una marca por encabezado, al borde de la columna del
 * documento, para saltar de sección sin abrir nada ni rodar el scroll.
 *
 * En reposo todas las marcas son iguales: un bloque compacto de rayas cortas
 * que no pide atención. La que está bajo el puntero crece y se aclara, y sus
 * vecinas crecen menos según se alejan, como los iconos de un dock. Esa lupa
 * es lo que hace que se pueda apuntar a una raya de tres píxeles.
 *
 * No se pinta en un teléfono: no hay puntero que pasar por encima y la columna
 * va demasiado apretada para regalarle el margen. Ahí el índice vive en el
 * panel lateral, que ya se abre a altura completa.
 */

/** Un carril de una sola marca no navega a ningún sitio: es ruido. */
export const RAIL_MIN_ITEMS = 2;

/**
 * El ancho de la marca según lo lejos que esté de la que tiene el puntero, en
 * píxeles. El último valor es el de reposo y vale para todas las demás.
 *
 * Estos cuatro números y el paso van en píxeles y no en la escala `em` del
 * resto del producto, a propósito: una marca de tres píxeles es de la clase
 * hairline, y creciera con el tamaño de letra del sistema dejaría de ser la
 * raya fina que es. Salen medidos del carril de T3 Code, que es la referencia.
 */
const MAGNIFY = [35, 23, 14, 12] as const;
const REST = MAGNIFY[MAGNIFY.length - 1];
const FULL = MAGNIFY[0];
/** Distancia de centro a centro entre dos marcas. */
const PITCH = 12;

/** Cuánto se estira la marca, como escala del ancho máximo. */
export function tickScale(distance: number): number {
  const width = distance < MAGNIFY.length ? MAGNIFY[distance] : REST;
  return width / FULL;
}

export interface DocumentRailProps {
  items: readonly OutlineItem[];
  onJump: (pos: number) => void;
}

export function DocumentRail({ items, onJump }: DocumentRailProps) {
  // Qué marca tiene el puntero encima. De ahí sale la lupa y la tarjeta, así
  // que es un solo estado y no dos que se puedan desincronizar.
  const [hovered, setHovered] = useState<number | null>(null);

  if (items.length < RAIL_MIN_ITEMS) return null;

  return (
    <nav
      aria-label="Títulos del documento"
      data-testid="document-rail"
      // Pegado al borde izquierdo de la columna cuando hay sitio, y al del
      // lienzo cuando no. La columna mide 48rem (max-w-3xl) y está centrada.
      style={{ left: "max(0.75rem, calc(50% - 24rem - 3.25rem))" }}
      className="absolute top-1/2 z-(--z-raised) hidden -translate-y-1/2 md:block"
      onMouseLeave={() => setHovered(null)}
    >
      <ul className="flex flex-col">
        {items.map((item, index) => {
          const open = hovered === index;
          return (
            <li key={item.pos} className="relative flex">
              <button
                type="button"
                onClick={() => onJump(item.pos)}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered((open2) => (open2 === index ? null : open2))}
                aria-label={item.label}
                // Tres píxeles de alto son imposibles de apuntar, así que el
                // objetivo es toda la fila: 12 de alto, el paso del carril.
                className="flex items-center outline-none"
                style={{ height: `${PITCH}px`, width: `${FULL}px` }}
              >
                <span
                  data-testid="rail-tick"
                  style={{
                    width: `${FULL}px`,
                    transform: `scaleX(${tickScale(distanceTo(hovered, index))})`,
                  }}
                  className={cn(
                    // Se estira con transform y no con width: una propiedad de
                    // layout animada repinta toda la columna en cada píxel.
                    "block h-[3px] origin-left rounded-full transition-[transform,background-color] duration-150 ease-out",
                    // Ni la marca encendida llega a blanco ni la de reposo baja
                    // del umbral en que se ve: los dos valores salen medidos
                    // del carril de referencia.
                    open ? "bg-foreground/70" : "bg-muted-foreground/45",
                  )}
                />
              </button>
              {open && <RailCard item={item} />}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Cuántas marcas hay entre esta y la que tiene el puntero. */
function distanceTo(hovered: number | null, index: number): number {
  return hovered === null ? MAGNIFY.length : Math.abs(hovered - index);
}

/**
 * De qué habla la sección, sin ir a verla. El nombre accesible de la marca ya
 * dice el título, así que para un lector de pantalla esto es un eco: se oculta
 * y no atrapa el puntero, que si no se lo quitaría a la marca que la abrió.
 */
export function RailCard({ item }: { item: OutlineItem }) {
  return (
    <div
      aria-hidden="true"
      data-testid="rail-card"
      className="pointer-events-none absolute left-full top-1/2 z-(--z-overlay) ml-3 w-80 -translate-y-1/2 rounded-2xl border border-border bg-popover p-4 shadow-xl"
    >
      <p className="truncate text-sm font-semibold text-popover-foreground">{item.label}</p>
      {item.preview && (
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {item.preview}
        </p>
      )}
    </div>
  );
}
