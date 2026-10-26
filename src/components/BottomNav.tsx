"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";
import { useCommandPaletteStore } from "@/features/command-palette/command-palette.store";
import { useTecladoAbierto } from "@/hooks/use-teclado-abierto";
import { DESTINOS_MOVIL, destinoActivo } from "./navigation";

/**
 * El pie del teléfono: papel con un hairline arriba, cinco palabras y el orbe
 * de crear aparte. Sin vidrio, sin desenfoque y sin iconos: cuatro palabras se
 * leen mejor que cuatro glifos de 24 px, y la activa va en ámbar con un punto
 * debajo. Buscar es la quinta palabra porque el atajo de teclado no existe en
 * touch y sin ella la búsqueda no tenía puerta en el teléfono. Calendario no
 * cabe: se alcanza desde la fecha de Hoy y desde el segmento de Tareas.
 *
 * Las cinco palabras reparten el ancho a partes iguales (`minmax(0,1fr)`, no
 * `auto`: una columna no crece hasta su palabra) y la columna del orbe mide
 * lo que el orbe, así que a 320 px «Sistemas» (49,5 px) cabe en su columna de
 * 52 px y deja hueco a «Bandeja» y a «Buscar». Debajo de 360 px el pie cede
 * 4 px de margen y de hueco; desde 360 px queda como estaba.
 *
 * Toca el borde de abajo a propósito y suma el área segura del dispositivo:
 * en un teléfono con barra de gestos el pie empieza encima de ella.
 *
 * Lo que el pie le quita a la pantalla vive en `--kino-bottom-chrome`, que
 * `<main>` reserva. Con el teclado abierto el pie se retira y la variable se
 * pone a cero, o quedaría flotando encima del campo que estás escribiendo.
 *
 * `rutaActual` existe para el catálogo, que enseña el pie con cada palabra
 * activa sin cambiar de página.
 */
export function BottomNav({ rutaActual }: { rutaActual?: string } = {}) {
  const pathname = usePathname();
  const ruta = rutaActual ?? pathname;
  const setQuickAddOpen = useQuickAddStore((s) => s.setOpen);
  const setPaletteOpen = useCommandPaletteStore((s) => s.setOpen);
  const tecladoAbierto = useTecladoAbierto();

  useEffect(() => {
    const raiz = document.documentElement;
    if (tecladoAbierto) raiz.style.setProperty("--kino-bottom-chrome", "0px");
    else raiz.style.removeProperty("--kino-bottom-chrome");
    return () => {
      raiz.style.removeProperty("--kino-bottom-chrome");
    };
  }, [tecladoAbierto]);

  if (tecladoAbierto) return null;

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-0 bottom-0 z-(--z-overlay) grid grid-cols-[minmax(0,1fr)_2.85rem] items-center gap-1 border-t border-border bg-background px-1 pb-[env(safe-area-inset-bottom)] min-[360px]:gap-1.5 min-[360px]:px-2 md:hidden"
      style={{ minHeight: "calc(var(--kino-bottom-nav) + env(safe-area-inset-bottom))" }}
    >
      <div className="grid h-[3.3rem] grid-cols-[repeat(5,minmax(0,1fr))]">
        {DESTINOS_MOVIL.map((destino) => (
          <Palabra
            key={destino.href}
            href={destino.href}
            label={destino.label}
            active={destinoActivo(destino.href, ruta)}
          />
        ))}
        <button type="button" onClick={() => setPaletteOpen(true)} className={palabraClass(false)}>
          Buscar
        </button>
      </div>

      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Nueva tarea"
        className="press flex size-[2.85rem] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_.5em_1.4em_-.4em_var(--glow)] transition-[background-color,transform] duration-(--dur-toque) ease-(--ease-pluma) focus-ring hover:bg-primary/90"
      >
        <Plus className="size-6" />
      </button>
    </nav>
  );
}

/** Una posición del pie, sea destino o Buscar: una palabra de 2.85rem o más de alto. */
function palabraClass(active: boolean) {
  return cn(
    "relative flex h-full min-h-[2.85rem] min-w-0 items-center justify-center rounded-md text-xs font-semibold transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  );
}

function Palabra({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={palabraClass(active)}>
      {label}
      {active && (
        <span
          aria-hidden
          data-slot="punto"
          className="absolute bottom-[0.35rem] left-1/2 size-[0.3rem] -translate-x-1/2 rounded-full bg-current"
        />
      )}
    </Link>
  );
}
