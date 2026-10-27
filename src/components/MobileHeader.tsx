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
    <header className="sticky top-0 z-(--z-overlay) flex min-h-[3.2rem] shrink-0 items-center justify-between border-b border-border bg-background pt-[env(safe-area-inset-top)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.25rem,env(safe-area-inset-right))] md:hidden">
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
            className="flex h-[2.85rem] min-w-[2.85rem] items-center justify-center rounded-md px-3 text-sm font-semibold text-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:text-primary"
          >
            Ajustes
          </Link>
        </>
      ) : (
        <Link
          href={cabecera.padreHref}
          className="flex h-[2.85rem] max-w-[75%] items-center gap-0.5 rounded-md pr-3 text-base font-semibold text-foreground transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:text-primary"
        >
          <ChevronLeft className="size-5 shrink-0 stroke-[2.2] text-muted-foreground" aria-hidden />
          <span className="truncate">{padre}</span>
        </Link>
      )}
    </header>
  );
}
