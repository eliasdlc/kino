"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Check, Trash2, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { allTasksKey } from "./tasks.keys";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  onClear: () => void;
}

const DATE_OPTIONS = [
  { value: "today", label: "Hoy" },
  { value: "tomorrow", label: "Mañana" },
  { value: "week", label: "Esta semana" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Crítica" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
] as const;

const ACTION_BTN =
  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent/50 transition-colors";

export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const queryClient = useQueryClient();
  const ids = [...selectedIds];
  const count = ids.length;

  if (count === 0) return null;

  async function bulkMove(status: string) {
    const res = await fetch("/api/tasks/bulk-move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: ids, status }),
    });
    if (!res.ok) throw new Error("No se pudo mover las tareas");
    await queryClient.invalidateQueries({ queryKey: allTasksKey() });
    onClear();
  }

  async function bulkUpdate(priority: string) {
    const res = await fetch("/api/tasks/bulk-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskIds: ids, priority }),
    });
    if (!res.ok) throw new Error("No se pudo actualizar la prioridad");
    await queryClient.invalidateQueries({ queryKey: allTasksKey() });
    onClear();
  }

  async function run(fn: () => Promise<void>, successMsg: string) {
    try {
      await fn();
      toast.success(successMsg);
    } catch {
      toast.error("No se pudo completar la acción");
    }
  }

  return (
    <div className="px-4 py-2.5 border-b bg-primary/5 flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-primary shrink-0">
        {count} seleccionada{count !== 1 ? "s" : ""}
      </span>

      {/* Fechar */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={ACTION_BTN}>
            Fechar <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          {DATE_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() =>
                run(
                  () => bulkMove(opt.value),
                  `${count} tarea${count !== 1 ? "s" : ""} → ${opt.label}`
                )
              }
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Prioridad */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={ACTION_BTN}>
            Prioridad <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          {PRIORITY_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onSelect={() =>
                run(
                  () => bulkUpdate(opt.value),
                  `Prioridad → ${opt.label}`
                )
              }
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Completar */}
      <button
        onClick={() =>
          run(
            () => bulkMove("done"),
            `${count} tarea${count !== 1 ? "s" : ""} completada${count !== 1 ? "s" : ""}`
          )
        }
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors"
      >
        <Check className="w-3.5 h-3.5" />
        Completar
      </button>

      {/* Eliminar — habilitado en KIN-26 cuando exista el endpoint de bulk-delete */}
      <button
        disabled
        title="Próximamente"
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground/40 cursor-not-allowed"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Eliminar
      </button>

      {/* Limpiar selección */}
      <button
        onClick={onClear}
        className="ml-auto p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Limpiar selección"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
