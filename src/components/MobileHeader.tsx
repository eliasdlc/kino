"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useSystems } from "@/features/systems/systems.hooks";
import { cabeceraDe } from "./navigation";

/**
 * La cabecera corrida del teléfono, papel con hairline y sin desenfoque. En
 * una pantalla raíz (Hoy, Tareas, Sistemas, Bandeja, Calendario) lleva la
 * marca a la izquierda y, a la derecha, la puerta a Ajustes: un botón de
 * 48 px con la palabra, porque una puerta que hay que adivinar no es una
 * puerta. En una pantalla anidada lleva «‹ padre» con el nombre del padre,
 * como el Volver de Apple Notes: el nombre del sistema sale de la lista de
 * sistemas, que el sidebar ya tiene suscrita.
 *
 * El título de cada pantalla no vive aquí: el único h1 va con la página.
 *
 * `rutaActual` existe para el catálogo, que enseña las dos formas sin cambiar
 * de página.
 */
export function MobileHeader({ rutaActual }: { rutaActual?: string } = {}) {
  const pathname = usePathname();
  const ruta = rutaActual ?? pathname;
  const cabecera = cabeceraDe(ruta);
  const { data: systems } = useSystems();

  const padre =
    cabecera.tipo === "anidada"
      ? (cabecera.padreLabel ?? systems?.find((s) => s.id === cabecera.systemId)?.name ?? "Sistema")
      : null;

  return (
    <header className="sticky top-0 z-(--z-overlay) flex h-[3.2rem] shrink-0 items-center justify-between border-b border-border bg-background pl-2 pr-1 md:hidden">
      {cabecera.tipo === "raiz" ? (
        <>
          <Link
            href="/dashboard"
            className="flex h-[2.85rem] items-center rounded-md px-2 font-display text-lg font-bold tracking-[-0.02em] text-foreground focus-ring"
          >
            Kino
          </Link>
          <Link
            href="/settings"
            className="flex h-[2.85rem] min-w-[2.85rem] items-center justify-center rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:text-foreground"
          >
            Ajustes
          </Link>
        </>
      ) : (
        <Link
          href={cabecera.padreHref}
          className="flex h-[2.85rem] max-w-[75%] items-center gap-0.5 rounded-md pr-3 text-base font-semibold text-primary transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring"
        >
          <ChevronLeft className="size-5 shrink-0 stroke-[2.2]" aria-hidden />
          <span className="truncate">{padre}</span>
        </Link>
      )}
    </header>
  );
}
