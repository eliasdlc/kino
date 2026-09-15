"use client";

import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";
import type { OutlineItem } from "./mediums/outline";

/**
 * El carril de títulos: una marca por encabezado, al borde de la columna del
 * documento, para saltar de sección sin abrir nada ni rodar el scroll.
 *
 * En reposo las marcas son iguales de ancho y sólo el brillo dice el nivel, así
 * que los títulos de primer nivel se encuentran de un vistazo sin que la
 * columna pierda su alineación. La que está bajo el puntero crece y se aclara,
 * y sus vecinas crecen menos según se alejan, como los iconos de un dock. Esa
 * lupa es lo que hace que se pueda apuntar a una raya de tres píxeles.
 *
 * Nunca crece más que el lienzo que lo sostiene: cuando el documento tiene más
 * títulos de los que caben, suelta niveles en vez de recortarse por los bordes.
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
 * Estos números y los pasos van en píxeles y no en la escala `em` del resto del
 * producto, a propósito: una marca de tres píxeles es de la clase hairline, y
 * creciendo con el tamaño de letra del sistema dejaría de ser la raya fina que
 * es. Salen medidos del carril de T3 Code, que es la referencia.
 */
const MAGNIFY = [35, 23, 14, 12] as const;
const REST = MAGNIFY[MAGNIFY.length - 1];
const FULL = MAGNIFY[0];
/** Distancia de centro a centro entre dos marcas. */
const PITCH = 12;
/** Hasta dónde se puede apretar el paso antes de que el carril deje de servir. */
const PITCH_MIN = 8;
/** Lo que el carril se permite ocupar del alto del lienzo. */
const BUDGET = 0.7;

/** Cuánto se ve la marca en reposo, según el nivel de su título. */
const LEVEL_TINT = [
  "bg-muted-foreground/70",
  "bg-muted-foreground/45",
  "bg-muted-foreground/28",
] as const;

/** Cuánto se estira la marca, como escala del ancho máximo. */
export function tickScale(distance: number): number {
  const width = distance < MAGNIFY.length ? MAGNIFY[distance] : REST;
  return width / FULL;
}

/** El tono de reposo de un título. Más allá del último nivel, el más apagado. */
export function levelTint(depth: number): string {
  return LEVEL_TINT[Math.min(Math.max(depth, 0), LEVEL_TINT.length - 1)];
}

export interface RailPlan {
  items: readonly OutlineItem[];
  /** Distancia de centro a centro, que es también el alto de cada fila. */
  pitch: number;
}

/**
 * Qué marcas se pintan y con qué paso, dado el alto disponible en píxeles.
 *
 * Un documento de setenta títulos no se navega por sus setenta títulos: se
 * navega por sus secciones de primer nivel. Así que cuando no caben, lo que
 * cede es el detalle y nunca los extremos: recortarse por los bordes dejaba
 * títulos a los que no se podía llegar, y sin avisar de que estaban.
 *
 * Devuelve `null` cuando no hay carril que pintar, incluido el caso de que ni
 * los títulos de primer nivel quepan al paso mínimo. Que se note que no hay
 * carril es mejor que truncar la lista en silencio.
 */
export function planRail(items: readonly OutlineItem[], budget: number): RailPlan | null {
  if (items.length < RAIL_MIN_ITEMS || budget <= 0) return null;

  const deepest = items.reduce((max, item) => Math.max(max, item.depth), 0);
  for (let depth = deepest; depth >= 0; depth--) {
    const kept = items.filter((item) => item.depth <= depth);
    if (kept.length >= RAIL_MIN_ITEMS && kept.length * PITCH <= budget) {
      return { items: kept, pitch: PITCH };
    }
  }

  // Ni el primer nivel cabe a paso normal: se aprieta hasta el suelo.
  const roots = items.filter((item) => item.depth === 0);
  if (roots.length < RAIL_MIN_ITEMS) return null;
  const pitch = budget / roots.length;
  return pitch >= PITCH_MIN ? { items: roots, pitch } : null;
}

/**
 * Mide el lienzo y le pasa al carril lo que tiene disponible. Vive aparte para
 * que un cambio de tamaño de ventana repinte el carril y nada más: el editor
 * cuelga del mismo árbol y no tiene por qué enterarse.
 */
export function DocumentRailLayer({
  items,
  scrollRef,
  onJump,
}: {
  items: readonly OutlineItem[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onJump: (pos: number) => void;
}) {
  const [budget, setBudget] = useState(0);

  useEffect(() => {
    const canvas = scrollRef.current;
    if (!canvas) return;
    const medir = () => setBudget(canvas.clientHeight * BUDGET);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [scrollRef]);

  return <DocumentRail items={items} budget={budget} onJump={onJump} />;
}

export interface DocumentRailProps {
  items: readonly OutlineItem[];
  /** Alto disponible en píxeles. Sin él no se pinta nada. */
  budget: number;
  onJump: (pos: number) => void;
}

export function DocumentRail({ items, budget, onJump }: DocumentRailProps) {
  // Qué marca tiene el puntero encima. De ahí sale la lupa y la tarjeta, así
  // que es un solo estado y no dos que se puedan desincronizar.
  const [hovered, setHovered] = useState<number | null>(null);

  const plan = planRail(items, budget);
  if (!plan) return null;

  return (
    <nav
      aria-label="Títulos del documento"
      data-testid="document-rail"
      // Pegado al borde izquierdo del lienzo, no a la columna de texto:
      // colgarlo de la columna deja un hueco vacío a su izquierda que no es de
      // nadie y se lee como un error de maquetación.
      className="absolute left-4 top-1/2 z-(--z-raised) hidden -translate-y-1/2 md:block"
      onMouseLeave={() => setHovered(null)}
    >
      <ul className="flex flex-col">
        {plan.items.map((item, index) => {
          const open = hovered === index;
          return (
            <li key={item.pos} className="relative flex">
              <button
                type="button"
                onClick={() => onJump(item.pos)}
                onMouseEnter={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered((abierta) => (abierta === index ? null : abierta))}
                aria-label={item.label}
                // Tres píxeles de alto son imposibles de apuntar, así que el
                // objetivo es toda la fila: el paso entero del carril.
                className="flex items-center outline-none"
                style={{ height: `${plan.pitch}px`, width: `${FULL}px` }}
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
                    // La marca encendida va por encima de cualquier nivel en
                    // reposo, que es lo que la separa de un título de primero.
                    open ? "bg-foreground/85" : levelTint(item.depth),
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
