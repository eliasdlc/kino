"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * La cabecera del teléfono: el menú y el nombre. Nada más. El "+" que vivía a
 * la derecha se fue con el orbe de la barra inferior: eran dos botones para el
 * mismo gesto a 56 px de distancia vertical, y el de abajo es el que cae bajo
 * el pulgar.
 */
export function MobileHeader() {
  const { setOpenMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-(--z-overlay) flex md:hidden items-center gap-2 h-14 px-2 bg-background/95 backdrop-blur-sm border-b border-border">
      <button
        onClick={() => setOpenMobile(true)}
        className="p-2 rounded-md hover:bg-accent transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </button>

      <Link
        href="/dashboard"
        className="font-bold text-lg tracking-tight"
      >
        Kino
      </Link>
    </header>
  );
}
