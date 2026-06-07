"use client";

import Link from "next/link";
import { Menu, Plus } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { useQuickAddStore } from "@/features/tasks/quick-add.store";

export function MobileHeader() {
  const { setOpenMobile } = useSidebar();
  const setOpen = useQuickAddStore((s) => s.setOpen);

  return (
    <header className="sticky top-0 z-20 flex md:hidden items-center justify-between h-14 px-2 bg-background/95 backdrop-blur-sm border-b border-border">
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

      <button
        onClick={() => setOpen(true)}
        className="p-2 rounded-md hover:bg-accent transition-colors"
        aria-label="Nueva tarea"
      >
        <Plus className="size-5" />
      </button>
    </header>
  );
}
