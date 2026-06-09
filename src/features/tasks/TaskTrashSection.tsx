"use client";

import { useTrashedTasks, useRestoreTask } from "./tasks.hooks";
import { RotateCcw, Trash2 } from "lucide-react";

/**
 * Papelera: lista las tareas con deleted_at IS NOT NULL del sistema y permite
 * restaurarlas. "Borrar" = deletedAt (papelera); "archivar" = status terminal —
 * son conceptos separados (PLAN-09 F2.3).
 */
export function TaskTrashSection({ systemId }: { systemId: string }) {
  const { data: trashed = [], isLoading } = useTrashedTasks(systemId);
  const { mutate: restore } = useRestoreTask();

  if (isLoading || trashed.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 w-full border-t pt-4 mt-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Trash2 size={16} className="shrink-0" />
        <h3 className="text-sm font-semibold">Papelera</h3>
        <span className="text-xs">({trashed.length})</span>
      </div>
      {trashed.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
        >
          <span className="flex-1 min-w-0 truncate text-sm text-muted-foreground line-through">
            {task.title}
          </span>
          <button
            type="button"
            onClick={() => restore(task.id)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <RotateCcw size={14} className="shrink-0" />
            Restaurar
          </button>
        </div>
      ))}
    </div>
  );
}
