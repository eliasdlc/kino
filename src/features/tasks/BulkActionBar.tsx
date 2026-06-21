"use client";

import { ChevronDown, Check, Trash2, X, ListChecks } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBulkMove, useBulkUpdate } from "./tasks.hooks";

interface BulkActionBarProps {
  selectedIds: Set<string>;
  onClear: () => void;
  onVaciar?: () => void;
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

const BTN =
  "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent/50 transition-colors";

export function BulkActionBar({ selectedIds, onClear, onVaciar }: BulkActionBarProps) {
  const ids = [...selectedIds];
  const count = ids.length;

  const { mutate: bulkMove, isPending: movePending } = useBulkMove();
  const { mutate: bulkUpdate, isPending: updatePending } = useBulkUpdate();
  const isPending = movePending || updatePending;

  if (count === 0) return null;

  function move(status: string) {
    bulkMove({ taskIds: ids, status }, { onSuccess: onClear });
  }

  function update(priority: string) {
    bulkUpdate({ taskIds: ids, priority }, { onSuccess: onClear });
  }

  return (
    <div className="px-4 py-2.5 border-b bg-primary/5 flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-primary shrink-0">
        {count} seleccionada{count !== 1 ? "s" : ""}
      </span>

      {/* Fechar */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={BTN} disabled={isPending}>
            Fechar <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          {DATE_OPTIONS.map((opt) => (
            <DropdownMenuItem key={opt.value} onSelect={() => move(opt.value)}>
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Prioridad */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={BTN} disabled={isPending}>
            Prioridad <ChevronDown className="w-3 h-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          {PRIORITY_OPTIONS.map((opt) => (
            <DropdownMenuItem key={opt.value} onSelect={() => update(opt.value)}>
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Completar */}
      <button
        onClick={() => move("done")}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:text-emerald-400 transition-colors disabled:opacity-40"
      >
        <Check className="w-3.5 h-3.5" />
        Completar
      </button>

      {/* Vaciar (cascade mode) */}
      {onVaciar && (
        <button
          onClick={onVaciar}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-accent/50 transition-colors disabled:opacity-40"
        >
          <ListChecks className="w-3.5 h-3.5" />
          Vaciar
        </button>
      )}

      {/* Eliminar — pending bulk-delete endpoint */}
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
