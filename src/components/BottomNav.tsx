"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, LayoutDashboard, List, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Hoy" },
  { href: "/systems", icon: Box, label: "Sistemas" },
  { href: "/tasks", icon: List, label: "Tareas" },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

/**
 * El chrome móvil: la barra de destinos y el orbe de crear, dos objetos que
 * flotan sobre el contenido sin tocar ningún borde. La barra es vidrio; el
 * destino activo es el acento sobre su propio pill y el glifo se rellena al
 * 22 por ciento, nunca un segundo icono. El contenido de `(app)` reserva
 * 5.4rem abajo para que la última fila de cualquier lista quede a la vista.
 */
export function BottomNav() {
  const pathname = usePathname();
  const setOpen = useQuickAddStore((s) => s.setOpen);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <nav
      aria-label="Secciones"
      className="fixed inset-x-[0.9rem] z-(--z-overlay) grid grid-cols-[1fr_3.3rem] items-center gap-[0.6rem] md:hidden"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-4 rounded-full border border-(--glass-ln) bg-(--glass) p-[0.3rem] shadow-[0_0.8em_2em_-0.8em_rgba(0,0,0,0.6)] backdrop-blur-[1.4rem] backdrop-saturate-[1.8]">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-[3.6rem] flex-col items-center justify-center gap-[0.15rem] rounded-full text-[0.6rem] font-semibold transition-colors",
                active ? "bg-(--glass-on) text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-6", active ? "fill-primary/20 stroke-2" : "stroke-[1.8]")} />
              <span className="leading-none">{label}</span>
            </Link>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-[3.3rem] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_0.5em_1.4em_-0.4em_var(--glow)] transition-transform hover:bg-primary/90 active:scale-95"
        aria-label="Nueva tarea"
      >
        <Plus className="size-6" />
      </button>
    </nav>
  );
}
