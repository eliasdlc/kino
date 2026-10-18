"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";
import { useCommandPaletteStore } from "@/features/command-palette/command-palette.store";
import { DESTINOS_MOVIL, destinoActivo } from "./navigation";

/**
 * Cuánto tiene que encogerse el viewport visual para que sea el teclado y no
 * las barras del navegador apareciendo. Por debajo de esto es cromo del
 * navegador; por encima sólo cabe un teclado.
 */
const UMBRAL_TECLADO = 150;


/**
 * El pie del teléfono: papel con un hairline arriba, cinco palabras y el orbe
 * de crear aparte. Sin vidrio, sin desenfoque y sin iconos: cuatro palabras se
 * leen mejor que cuatro glifos de 24 px, y la activa va en ámbar con un punto
 * debajo. Buscar es la quinta palabra porque el atajo de teclado no existe en
 * touch y sin ella la búsqueda no tenía puerta en el teléfono. Calendario no
 * cabe: se alcanza desde la fecha de Hoy y desde el segmento de Tareas.
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
      className="fixed inset-x-0 bottom-0 z-(--z-overlay) grid grid-cols-[1fr_auto] items-center gap-1.5 border-t border-border bg-background px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      style={{ minHeight: "calc(var(--kino-bottom-nav) + env(safe-area-inset-bottom))" }}
    >
      <div className="grid h-[3.3rem] grid-cols-5">
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
    "relative flex h-full min-h-[2.85rem] items-center justify-center rounded-md text-xs font-semibold transition-colors duration-(--dur-toque) ease-(--ease-pluma) focus-ring",
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

/** Si el foco está en algo donde se escribe. */
function escribiendoEn(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const tipo = (el as HTMLInputElement).type;
  return !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color"].includes(tipo);
}

/**
 * Si el teclado del teléfono está tapando la parte de abajo de la pantalla.
 * Dos señales, porque ninguna sola llega siempre: el viewport visual que se
 * encoge más de lo que miden las barras del navegador, y el foco dentro de un
 * campo cuando el puntero es un dedo (en un escritorio estrecho el foco en un
 * campo no abre ningún teclado).
 */
function useTecladoAbierto(): boolean {
  const [porViewport, setPorViewport] = useState(false);
  const [porFoco, setPorFoco] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const mirar = () => setPorViewport(window.innerHeight - viewport.height > UMBRAL_TECLADO);
    mirar();
    viewport.addEventListener("resize", mirar);
    return () => viewport.removeEventListener("resize", mirar);
  }, []);

  useEffect(() => {
    const dedo = window.matchMedia("(pointer: coarse)");
    const mirar = () => setPorFoco(dedo.matches && escribiendoEn(document.activeElement));
    document.addEventListener("focusin", mirar);
    document.addEventListener("focusout", mirar);
    return () => {
      document.removeEventListener("focusin", mirar);
      document.removeEventListener("focusout", mirar);
    };
  }, []);

  return porViewport || porFoco;
}
