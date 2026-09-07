"use client";

import Link from "next/link";
import { AlertTriangle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { getSystemColor } from "@/shared/utils/system-colors";
import { SYSTEM_TYPE_CONFIG, type SystemType } from "@/shared/lib/system-types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SystemWithSignalsTransport } from "./systems.types";

interface SystemCardProps {
  system: SystemWithSignalsTransport;
  onEdit: () => void;
  onDelete: () => void;
}

/** "hoy", "ayer", "hace 12 días", o nada si nunca hubo actividad. */
function activityLabel(days: number | null): string {
  if (days === null) return "sin actividad";
  if (days === 0) return "activo hoy";
  if (days === 1) return "activo ayer";
  return `hace ${days} días`;
}

/**
 * Un sistema es una fila, no una tarjeta con ilustración: el punto de color
 * como categoría, el nombre, el tipo en texto, la actividad y las tareas
 * activas, y el menú a la derecha. Mucha información sin ruido.
 */
export function SystemCard({ system, onEdit, onDelete }: SystemCardProps) {
  const color = getSystemColor(system.color);
  const typeLabel =
    SYSTEM_TYPE_CONFIG[system.templateType as SystemType]?.label ?? system.templateType;
  const count = system.activeTaskCount;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
          <span className={cn("size-2.5 shrink-0 rounded-full", color)} aria-hidden />
          <Link href={`/systems/${system.id}`} className="min-w-0" aria-label={`Abrir sistema ${system.name}`}>
            <p className="truncate text-[0.95rem] font-semibold leading-snug">{system.name}</p>
            <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
              <span>{typeLabel}</span>
              <span>· {count} {count === 1 ? "tarea activa" : "tareas activas"}</span>
              <span>· {activityLabel(system.daysSinceLastActivity)}</span>
              {system.stale && (
                <span className="inline-flex items-center gap-1 font-semibold text-task-overdue">
                  <AlertTriangle className="size-3" />
                  dormido
                </span>
              )}
            </p>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Opciones de ${system.name}`}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem className="gap-2" onClick={onEdit}>
                <Pencil className="size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" className="gap-2" onClick={onDelete}>
                <Trash2 className="size-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-40">
        <ContextMenuItem className="gap-2" onSelect={onEdit}>
          <Pencil className="size-4" /> Editar
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" className="gap-2" onSelect={onDelete}>
          <Trash2 className="size-4" /> Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
