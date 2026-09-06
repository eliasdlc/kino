"use client";

import Link from "next/link";
import {
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ListTodo,
  AlertTriangle,
} from "lucide-react";
import { getSystemColorHex, darkenHex } from "@/shared/utils/system-colors";
import { PhysicalCard } from "@/components/PhysicalCard";
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
import type { SystemWithSignalsTransport } from "./systems.types";

interface SystemCardProps {
  system: SystemWithSignalsTransport;
  onEdit: () => void;
  onDelete: () => void;
}

export function SystemCard({ system, onEdit, onDelete }: SystemCardProps) {
  const colorHex = getSystemColorHex(system.color);
  const trackColor = darkenHex(colorHex, 22);
  const openColor = darkenHex(colorHex, 45);
  const typeLabel =
    SYSTEM_TYPE_CONFIG[system.templateType as SystemType]?.label ?? system.templateType;
  const count = system.activeTaskCount;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>
    <PhysicalCard
      href={`/systems/${system.id}`}
      ariaLabel={`Abrir sistema ${system.name}`}
      className={system.stale ? "ring-1 ring-amber-500/50" : undefined}
      menu={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-full bg-background/70 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
              aria-label="Opciones de sistema"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem asChild>
              <Link href={`/systems/${system.id}`} className="flex items-center gap-2">
                <Eye className="size-4" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {/* Archive body: solid system color with a faint top sheen for depth */}
      <div className="absolute inset-0 rounded-[20px] sm:rounded-[28px]" style={{ background: colorHex }} />
      <div className="absolute inset-x-0 top-0 h-2/5 rounded-t-[20px] bg-gradient-to-b from-white/10 to-transparent sm:rounded-t-[28px]" />

      {/* Zipper: runs down the centre to the label band */}
      <div className="absolute bottom-[42%] left-1/2 top-[12%] w-[11px] -translate-x-1/2">
        {/* closed channel */}
        <div className="absolute inset-0 rounded-full" style={{ background: trackColor }} />
        {/* teeth */}
        <div
          className="absolute inset-0 rounded-full opacity-80"
          style={{
            background:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 2px, transparent 2px, transparent 4.5px)",
          }}
        />
        {/* opening: grows downward on hover */}
        <div
          className="absolute left-1/2 top-0 h-[8%] w-[5px] -translate-x-1/2 rounded-full transition-all duration-300 ease-out group-hover:h-[28%]"
          style={{ background: openColor }}
        />
        {/* pull tab: slides down on hover */}
        <div className="absolute left-1/2 top-[6%] z-10 flex -translate-x-1/2 flex-col items-center transition-all duration-300 ease-out group-hover:top-[30%]">
          <div className="h-4 w-5 rounded-[3px] bg-zinc-100 shadow-md ring-1 ring-black/15" />
          <div className="h-3 w-1.5 rounded-b-full bg-zinc-300" />
        </div>
      </div>

      {/* Label band: flat-topped (no folder tab), with a system-colour accent */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-[42%] rounded-b-[20px] bg-card shadow-[0_-3px_10px_rgba(0,0,0,0.10)] sm:rounded-b-[28px]">
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: colorHex }} />
        <div className="absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold leading-tight text-foreground sm:text-sm">
              {system.name}
            </h3>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
              {typeLabel}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ListTodo size={14} strokeWidth={2.2} />
            <span className="text-[11px] font-medium tabular-nums sm:text-xs">
              {count} {count === 1 ? "tarea" : "tareas"}
            </span>
            {system.stale && (
              <span
                className="ml-auto inline-flex items-center text-amber-600 dark:text-amber-500"
                title="Sistema inactivo"
              >
                <AlertTriangle size={12} />
              </span>
            )}
          </div>
        </div>
      </div>
    </PhysicalCard>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-36">
        <ContextMenuItem asChild>
          <Link href={`/systems/${system.id}`} className="flex items-center gap-2">
            <Eye className="size-4" /> View
          </Link>
        </ContextMenuItem>
        <ContextMenuItem className="gap-2" onSelect={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" className="gap-2" onSelect={onDelete}>
          <Trash2 className="size-3.5" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
