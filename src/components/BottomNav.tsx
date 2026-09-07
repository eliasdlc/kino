"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, LayoutDashboard, List, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";
import { useCommandPaletteStore } from "@/features/command-palette/command-palette.store";

const DESTINOS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Hoy" },
  { href: "/tasks", icon: List, label: "Tareas" },
  { href: "/systems", icon: Box, label: "Sistemas" },
  { href: "/settings", icon: Settings, label: "Ajustes" },
] as const;

/**
 * Cuánto tiene que encogerse el viewport visual para que sea el teclado y no
 * las barras del navegador apareciendo. Por debajo de esto es cromo del
 * navegador; por encima sólo cabe un teclado.
 */
const UMBRAL_TECLADO = 150;

/**
 * El chrome móvil: la barra de destinos y el orbe de crear, dos objetos que
 * flotan sobre el contenido sin tocar ningún borde. La barra es vidrio; el
 * destino activo es el acento sobre su propio pill y el glifo se rellena al
 * 22 por ciento, nunca un segundo icono.
 *
 * Cinco posiciones, y la del medio no es un sitio: es Buscar, que en el
 * teléfono no tiene otra puerta porque el atajo de teclado no existe en touch.
 * Sin ella la búsqueda sencillamente no existía en el móvil.
 *
 * Lo que la barra le quita a la pantalla vive en `--kino-bottom-chrome`, que
 * `<main>` reserva. Con el teclado abierto la barra se retira y la variable se
 * pone a cero, o quedaría flotando encima del campo que estás escribiendo.
 */
export function BottomNav() {
  const pathname = usePathname();
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

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  if (tecladoAbierto) return null;

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-[0.9rem] z-(--z-overlay) grid grid-cols-[1fr_3.3rem] items-center gap-[0.6rem] md:hidden"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-5 rounded-full border border-(--glass-ln) bg-(--glass) p-[0.3rem] shadow-[0_0.8em_2em_-0.8em_rgba(0,0,0,0.6)] backdrop-blur-[1.4rem] backdrop-saturate-[1.8]">
        {DESTINOS.slice(0, 2).map((destino) => (
          <NavLink key={destino.href} {...destino} active={isActive(destino.href)} />
        ))}
        <button type="button" onClick={() => setPaletteOpen(true)} className={slotClass(false)}>
          <Search className="size-6 stroke-[1.8]" />
          <span className="leading-none">Buscar</span>
        </button>
        {DESTINOS.slice(2).map((destino) => (
          <NavLink key={destino.href} {...destino} active={isActive(destino.href)} />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        aria-label="Nueva tarea"
        className="flex size-[3.3rem] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0.5em_1.4em_-0.4em_var(--glow)] transition-transform hover:bg-primary/90 active:scale-95"
      >
        <Plus className="size-6" />
      </button>
    </nav>
  );
}

/** El hueco de una posición de la barra, sea destino o acción. */
function slotClass(active: boolean) {
  return cn(
    "flex h-[3.6rem] flex-col items-center justify-center gap-[0.15rem] rounded-full text-[0.6rem] font-semibold transition-colors",
    active ? "bg-(--glass-on) text-primary" : "text-muted-foreground hover:text-foreground",
  );
}

function NavLink({ href, icon: Icon, label, active }: { href: string; icon: typeof List; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={slotClass(active)}>
      <Icon className={cn("size-6", active ? "fill-primary/20 stroke-2" : "stroke-[1.8]")} />
      <span className="leading-none">{label}</span>
    </Link>
  );
}

/** Si el teclado del teléfono está tapando la parte de abajo de la pantalla. */
function useTecladoAbierto(): boolean {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const mirar = () => setAbierto(window.innerHeight - viewport.height > UMBRAL_TECLADO);
    mirar();
    viewport.addEventListener("resize", mirar);
    return () => viewport.removeEventListener("resize", mirar);
  }, []);

  return abierto;
}
