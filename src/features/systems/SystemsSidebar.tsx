"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSystems } from "./systems.hooks";

export function SystemsSidebar() {
  const pathname = usePathname();
  const { data: systems, isLoading } = useSystems();

  return (
    <aside className="w-64 h-screen border-r flex flex-col">
      {/* Header / logo */}
      <div className="p-4 border-b">
        <span className="font-semibold">Kino</span>
      </div>

      {/* Lista de sistemas */}
      <nav className="flex-1 overflow-y-auto p-2">
        {isLoading && <p className="text-sm text-muted-foreground p-2">Cargando...</p>}
        {systems?.map((system: any) => (
          <Link
            key={system.id}
            href={`/systems/${system.id}`}
            className={/* activo si pathname === `/systems/${system.id}` */ ""}
          >
            {/* TODO: icono + nombre del sistema */}
            {system.name}
          </Link>
        ))}
      </nav>

      {/* Footer — botón crear sistema + user info */}
      <div className="p-4 border-t">
        {/* TODO: botón crear sistema */}
      </div>
    </aside>
  );
}
