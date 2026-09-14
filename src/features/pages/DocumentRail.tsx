"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { OutlineItem } from "./mediums/outline";

/**
 * El carril de títulos: una marca por encabezado, al borde de la columna del
 * documento, para saltar de sección sin abrir nada ni rodar el scroll.
 *
 * Es un índice, no un minimapa: las marcas se reparten a lo alto del carril y
 * no van donde cae el título en el documento. Lo que dice el nivel es el ancho,
 * y el único color es el de la marca donde estás.
 *
 * No se pinta en un teléfono: no hay puntero que pasar por encima y la columna
 * va demasiado apretada para regalarle el margen. Ahí el índice vive en el
 * panel lateral, que ya se abre a altura completa.
 */

/** Un carril de una sola marca no navega a ningún sitio: es ruido. */
export const RAIL_MIN_ITEMS = 2;

/** El ancho de la marca dice el nivel del título. Tres niveles, tres anchos. */
const TICK_WIDTH = ["w-4", "w-3", "w-2"] as const;

function tickWidth(depth: number): string {
  return TICK_WIDTH[Math.min(depth, TICK_WIDTH.length - 1)];
}

export interface DocumentRailProps {
  items: readonly OutlineItem[];
  /** Posición del título de la sección que se está leyendo, o null. */
  activePos: number | null;
  onJump: (pos: number) => void;
}

export function DocumentRail({ items, activePos, onJump }: DocumentRailProps) {
  // La tarjeta la abre el puntero y también el foco: una marca a la que se
  // llega con Tab tiene que decir lo mismo que una a la que se llega con el
  // ratón. Es estado y no `:hover` de CSS porque nada más que una marca a la
  // vez puede estar abierta.
  const [openPos, setOpenPos] = useState<number | null>(null);

  if (items.length < RAIL_MIN_ITEMS) return null;

  const close = (pos: number) => setOpenPos((open) => (open === pos ? null : open));

  return (
    <nav
      aria-label="Títulos del documento"
      data-testid="document-rail"
      // Pegado al borde izquierdo de la columna cuando hay sitio, y al del
      // lienzo cuando no. La columna mide 48rem (max-w-3xl) y está centrada.
      style={{ left: "max(0.75rem, calc(50% - 24rem - 1.75rem))" }}
      className="absolute inset-y-8 z-(--z-raised) hidden md:block"
    >
      <ul className="flex h-full flex-col justify-evenly">
        {items.map((item) => {
          const active = item.pos === activePos;
          return (
            <li key={item.pos} className="relative flex">
              <button
                type="button"
                onClick={() => onJump(item.pos)}
                onMouseEnter={() => setOpenPos(item.pos)}
                onMouseLeave={() => close(item.pos)}
                onFocus={() => setOpenPos(item.pos)}
                onBlur={() => close(item.pos)}
                aria-label={item.label}
                aria-current={active ? "location" : undefined}
                className="flex h-4 items-center rounded-sm px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "block rounded-full transition-colors",
                    tickWidth(item.depth),
                    active ? "h-0.5 bg-primary" : "h-px bg-muted-foreground/45",
                  )}
                />
              </button>
              {item.pos === openPos && <RailCard item={item} />}
            </li>
          );
        })}
      </ul>
    </nav>
  );
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
      className="pointer-events-none absolute left-full top-1/2 z-(--z-overlay) ml-2 w-64 -translate-y-1/2 rounded-xl border border-border bg-popover p-3 shadow-lg"
    >
      <p className="truncate text-sm font-semibold text-popover-foreground">{item.label}</p>
      {item.preview && (
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {item.preview}
        </p>
      )}
    </div>
  );
}
