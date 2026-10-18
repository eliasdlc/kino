"use client";

import { Trash2 } from "lucide-react";
import type { TaskTransport } from "./tasks.types";
import { TaskRow } from "./TaskRow";
import { dueMeta } from "./task-vocab";

interface PlanningTaskCardProps {
  task: TaskTransport;
  isFocused?: boolean;
  onToggle: (taskId: string) => void;
  onDelete: (task: TaskTransport) => void;
  onEdit?: (task: TaskTransport) => void;
}

/** La meta corta de una columna: vencida o vence con su fecha, y evento si lo es. */
function planningMeta(task: TaskTransport): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  if (task.taskType === "event") parts.push("evento");
  const due = dueMeta(task.dueDate, task.status === "done");
  if (due.word) {
    parts.push(
      due.overdue ? (
        <span key="due">
          <b className="font-semibold text-task-overdue">vencida</b> {due.when}
        </span>
      ) : (
        `vence ${due.when}`
      ),
    );
  }
  return parts;
}

/**
 * La tarea en una columna de Planificación: la fila de tarea común en su
 * densidad `compacta`. Cada columna mide un séptimo del ancho, así que la
 * meta se reduce a la fecha (y evento) y no hay cola. El círculo mide 48 px en
 * el teléfono, donde la vista es una lista y no columnas; con ratón encoge.
 */
export function PlanningTaskCard({ task, isFocused, onToggle, onDelete, onEdit }: PlanningTaskCardProps) {
  return (
    <TaskRow
      task={task}
      density="compacta"
      focused={isFocused}
      onComplete={() => onToggle(task.id)}
      onOpen={onEdit ? () => onEdit(task) : undefined}
      meta={planningMeta(task)}
      actions={[{ label: "Mover a la papelera", icon: Trash2, destructive: true, onSelect: () => onDelete(task) }]}
    />
  );
}
